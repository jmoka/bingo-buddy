import React, { createContext, useContext, useEffect } from 'react';
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
      // Adicionada ordenação decrescente por data para as vitórias mais recentes ficarem no topo
      const { data, error } = await supabase
        .from('vitorias')
        .select('*')
        .eq('player_id', user.id)
        .order('won_at', { ascending: false });
      if (error) throw error;
      return data as Win[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas' }, () => {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
        queryClient.refetchQueries({ queryKey: ['matches'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cartelas_partida' }, () => {
        queryClient.invalidateQueries({ queryKey: ['matchCards'] });
        queryClient.refetchQueries({ queryKey: ['matchCards'] });
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