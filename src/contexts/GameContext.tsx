import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Win, GameSettings } from '@/types/match';
import { useGameSettings } from '@/hooks/useGameSettings';
import { useMatches } from '@/hooks/useMatches';
import { usePlayerCards } from '@/hooks/usePlayerCards';
import { useCreditRequests } from '@/hooks/useCreditRequests';
import { useRedeemRequests } from '@/hooks/useRedeemRequests';
import { useAdminData } from '@/hooks/useAdminData';

// Combine all return types from hooks into one giant context type
type GameContextType = 
  ReturnType<typeof useGameSettings> &
  ReturnType<typeof useMatches> &
  ReturnType<typeof usePlayerCards> &
  ReturnType<typeof useCreditRequests> &
  ReturnType<typeof useRedeemRequests> &
  ReturnType<typeof useAdminData> &
  {
    wins: Win[];
    allWins: Win[];
  };

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const processingRef = useRef(new Set<string>());
  const lastProcessedTimestampRef = useRef(new Map<string, string>());

  const gameSettingsHook = useGameSettings();
  const matchesHook = useMatches();
  const playerCardsHook = usePlayerCards();
  const creditRequestsHook = useCreditRequests();
  const redeemRequestsHook = useRedeemRequests();
  const adminDataHook = useAdminData();

  const { data: wins = [] } = useQuery({
    queryKey: ['wins', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('vitorias').select('*').eq('player_id', user.id);
      if (error) throw error;
      return data as Win[];
    },
    enabled: !!user,
  });

  // Timer for countdowns and auto-actions
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Effect for auto-starting and auto-calling
  useEffect(() => {
    matchesHook.matches.forEach(match => {
      // Auto-start logic
      const processingKeyStart = `start_${match.id}`;
      if (
        match.is_auto_calling &&
        match.status === 'open' &&
        now >= new Date(match.start_time).getTime() &&
        !processingRef.current.has(processingKeyStart)
      ) {
        processingRef.current.add(processingKeyStart);
        matchesHook.startMatch(match.id, true).finally(() => {
           setTimeout(() => processingRef.current.delete(processingKeyStart), 5000);
        });
      }

      // Auto-call logic (Proteção contra chamadas extras)
      const processingKeyCall = `call_${match.id}`;
      const nextTimestamp = match.next_auto_call_timestamp;
      
      if (
        match.is_auto_calling &&
        match.status === 'in_progress' && // SÓ sorteia se estiver em progresso
        nextTimestamp &&
        now >= new Date(nextTimestamp).getTime() &&
        !processingRef.current.has(processingKeyCall) &&
        lastProcessedTimestampRef.current.get(match.id) !== nextTimestamp
      ) {
        lastProcessedTimestampRef.current.set(match.id, nextTimestamp);
        processingRef.current.add(processingKeyCall);
        
        console.log(`[Bingo] Chamando número automático para: ${match.name}`);
        
        const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
          .filter(num => !(match.called_numbers || []).includes(num));
          
        if (availableNumbers.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableNumbers.length);
          matchesHook.callNumber(match.id, availableNumbers[randomIndex]).finally(() => {
            // Pequeno delay para o banco de dados atualizar antes de liberar a próxima chamada
            setTimeout(() => processingRef.current.delete(processingKeyCall), 3000);
          });
        } else {
          processingRef.current.delete(processingKeyCall);
        }
      }
    });
  }, [now, matchesHook.matches]);

  useEffect(() => {
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
        queryClient.invalidateQueries({ queryKey: ['matchCards'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['wins'] });
        queryClient.invalidateQueries({ queryKey: ['creditRequests'] });
        queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const value = {
    ...gameSettingsHook,
    ...matchesHook,
    ...playerCardsHook,
    ...creditRequestsHook,
    ...redeemRequestsHook,
    ...adminDataHook,
    wins,
    allWins: adminDataHook.allWins,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider');
  return context;
};