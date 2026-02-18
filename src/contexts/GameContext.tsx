import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Win } from '@/types/match';
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
  const processingRef = useRef(new Set());

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
      const processingKeyStart = `start_${match.id}`;
      if (
        match.is_auto_calling &&
        match.status === 'open' &&
        now >= new Date(match.start_time).getTime() &&
        !processingRef.current.has(processingKeyStart)
      ) {
        processingRef.current.add(processingKeyStart);
        console.log(`Automatically starting match: ${match.name} (${match.id})`);
        matchesHook.startMatch(match.id, true);
      }

      const processingKeyCall = `call_${match.id}`;
      if (
        match.is_auto_calling &&
        match.status === 'in_progress' &&
        match.next_auto_call_timestamp &&
        now >= new Date(match.next_auto_call_timestamp).getTime() &&
        !processingRef.current.has(processingKeyCall)
      ) {
        processingRef.current.add(processingKeyCall);
        const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(num => !match.called_numbers.includes(num));
        if (availableNumbers.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableNumbers.length);
          matchesHook.callNumber(match.id, availableNumbers[randomIndex]).finally(() => {
            setTimeout(() => processingRef.current.delete(processingKeyCall), 500);
          });
        } else {
          matchesHook.toggleAutoCall(match.id);
          processingRef.current.delete(processingKeyCall);
        }
      }
    });
  }, [now, matchesHook.matches, matchesHook.startMatch, matchesHook.callNumber, matchesHook.toggleAutoCall]);

  useEffect(() => {
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        console.log('Change received!', payload);
        queryClient.invalidateQueries();
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