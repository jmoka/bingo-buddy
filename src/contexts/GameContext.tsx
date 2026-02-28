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
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const processingRef = useRef(new Set<string>());
  const lastProcessedTimestampRef = useRef(new Map<string, string>());
  const lastHeartbeatRef = useRef(0);

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
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  // Effect for auto-starting and auto-calling (apenas admin executa o motor)
  useEffect(() => {
    if (profile?.role !== 'admin') return;

    // Heartbeat: Verifica se precisa criar uma nova partida a cada 30 segundos
    if (
      gameSettingsHook.gameSettings?.auto_engine_enabled && 
      now - lastHeartbeatRef.current > 30000
    ) {
      lastHeartbeatRef.current = now;
      const hasOpenMatch = matchesHook.matches.some(m => m.status === 'open');
      if (!hasOpenMatch) {
        if (import.meta.env.DEV) console.log("[Bingo] Heartbeat: Nenhuma partida aberta encontrada. Chamando motor...");
        supabase.functions.invoke('auto-match-engine');
      }
    }

    matchesHook.matches.forEach(match => {
      // Auto-start logic
      const processingKeyStart = `start_${match.id}`;
      const startTime = new Date(match.start_time).getTime();
      
      if (
        match.is_auto_calling &&
        match.status === 'open' &&
        now >= startTime &&
        !processingRef.current.has(processingKeyStart)
      ) {
        processingRef.current.add(processingKeyStart);
        if (import.meta.env.DEV) console.log(`[Bingo] Iniciando partida automática: ${match.name}`);
        
        matchesHook.startMatch(match.id, true).finally(() => {
           // Limpa a trava após 3 segundos para permitir novas ações se necessário
           setTimeout(() => processingRef.current.delete(processingKeyStart), 3000);
        });
      }

      // Auto-call logic (Proteção contra chamadas extras)
      const processingKeyCall = `call_${match.id}`;
      const nextTimestamp = match.next_auto_call_timestamp;
      
      if (
        match.is_auto_calling &&
        match.status === 'in_progress' && 
        nextTimestamp &&
        now >= new Date(nextTimestamp).getTime() &&
        !processingRef.current.has(processingKeyCall) &&
        lastProcessedTimestampRef.current.get(match.id) !== nextTimestamp
      ) {
        lastProcessedTimestampRef.current.set(match.id, nextTimestamp);
        processingRef.current.add(processingKeyCall);
        
        if (import.meta.env.DEV) console.log(`[Bingo] Chamando número automático para: ${match.name}`);
        
        matchesHook.callNumber(match.id).finally(() => {
          setTimeout(() => processingRef.current.delete(processingKeyCall), 2000);
        });
      }
    });
  }, [now, matchesHook.matches, gameSettingsHook.gameSettings, profile]);

  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas' }, () => {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cartelas_partida' }, () => {
        queryClient.invalidateQueries({ queryKey: ['matchCards'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfis' }, () => {
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['players'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vitorias' }, () => {
        queryClient.invalidateQueries({ queryKey: ['wins'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_credito' }, () => {
        queryClient.invalidateQueries({ queryKey: ['creditRequests'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
      })
      .subscribe();
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