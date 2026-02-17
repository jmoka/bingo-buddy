import React, { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Match, PlayerCard, MatchCard, Win, MatchStatus, CreditRequest } from '@/types/match';
import { toast } from 'sonner';
import { Profile } from './AuthContext';

export interface GameSettings {
  id: string;
  singleton: boolean;
  custo_nova_cartela: number;
  custo_recarga_cartela: number;
  usos_por_recarga: number;
  intervalo_sorteio_auto_seg: number;
  created_at: string;
  n8n_test_url?: string;
  n8n_prod_url?: string;
  n8n_env?: 'test' | 'production';
  pix_key?: string;
  credit_request_text?: string;
  valor_por_credito: number;
}

interface GameContextType {
  matches: Match[];
  players: Profile[];
  playerCards: PlayerCard[];
  allPlayerCards: PlayerCard[];
  matchCards: MatchCard[];
  wins: Win[];
  allWins: Win[];
  creditRequests: CreditRequest[];
  allCreditRequests: CreditRequest[];
  gameSettings: GameSettings | undefined;
  isLoading: boolean;
  createMatch: (data: any) => Promise<void>;
  openMatch: (matchId: string) => Promise<void>;
  startMatch: (matchId: string) => Promise<void>;
  callNumber: (matchId: string, num: number) => Promise<void>;
  finishMatch: (matchId: string) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  toggleAutoCall: (matchId: string) => Promise<void>;
  updateGameSettings: (newSettings: Partial<GameSettings>) => Promise<void>;
  createPlayerCard: (options: { name: string; numbers: number[][]; }) => Promise<PlayerCard | null>;
  deletePlayerCard: (cardId: string) => Promise<void>;
  toggleArchivePlayerCard: (cardId: string, archive: boolean) => Promise<void>;
  joinMatch: (matchId: string, playerCardIds: string[]) => Promise<MatchCard[] | null>;
  buyCardUses: (playerCardId: string) => Promise<boolean>;
  requestCredits: (file: File, creditsRequested: number, amountPaid: number) => Promise<boolean>;
  resolveCreditRequest: (requestId: string, status: 'approved' | 'rejected', creditsGranted?: number, notes?: string) => Promise<boolean>;
  deleteCreditRequest: (requestId: string) => Promise<void>;
  updatePlayerCredits: (playerId: string, amount: number) => Promise<void>;
  getMatchCards: (matchId: string) => MatchCard[];
  getPlayerMatchCards: (matchId: string, playerId: string) => MatchCard[];
}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = profile?.role === 'admin';

  const { data: matches = [], isLoading: l1 } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('partidas').select('*').order('start_time', { ascending: false });
      if (error) throw error;
      return data as Match[];
    },
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      const { data, error } = await supabase.from('perfis').select('*');
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isAdmin,
  });

  const { data: playerCards = [], isLoading: l2 } = useQuery({
    queryKey: ['playerCards', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('cartelas_jogador').select('*').eq('player_id', user.id);
      if (error) throw error;
      return data as PlayerCard[];
    },
    enabled: !!user,
  });

  const { data: allPlayerCards = [] } = useQuery({
    queryKey: ['allPlayerCards'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartelas_jogador').select('*');
      if (error) throw error;
      return data as PlayerCard[];
    },
    enabled: isAdmin,
  });

  const { data: matchCards = [], isLoading: l3 } = useQuery({
    queryKey: ['matchCards'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartelas_partida').select('*');
      if (error) throw error;
      return data.map(c => ({ ...c, marked_numbers: new Set(c.marked_numbers || []) })) as MatchCard[];
    },
  });

  const { data: wins = [], isLoading: l5 } = useQuery({
    queryKey: ['wins', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('vitorias').select('*').eq('player_id', user.id);
      if (error) throw error;
      return data as Win[];
    },
    enabled: !!user,
  });

  const { data: allWins = [] } = useQuery({
    queryKey: ['allWins'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vitorias').select('*');
      if (error) throw error;
      return data as Win[];
    },
    enabled: isAdmin,
  });

  const { data: creditRequests = [], isLoading: l6 } = useQuery({
    queryKey: ['creditRequests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('solicitacoes_credito')
        .select('*')
        .eq('player_id', user.id)
        .order('requested_at', { ascending: false });
      
      if (error) throw error;
      return data as CreditRequest[];
    },
    enabled: !!user,
  });

  const { data: allCreditRequests = [], isLoading: l7 } = useQuery({
    queryKey: ['allCreditRequests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes_credito')
        .select('*, perfis(full_name, avatar_url)')
        .order('requested_at', { ascending: false });
      if (error) throw error;
      return data as CreditRequest[];
    },
    enabled: isAdmin,
  });

  const { data: gameSettings, isLoading: l4 } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracoes').select('*').limit(1).single();
      if (error) {
        return {
          custo_nova_cartela: 10,
          custo_recarga_cartela: 5,
          usos_por_recarga: 1,
          intervalo_sorteio_auto_seg: 120,
          valor_por_credito: 1,
        } as GameSettings;
      }
      return data as GameSettings;
    },
    staleTime: 0,
  });

  useEffect(() => {
    const channel = supabase.channel('game-updates')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const table = payload.table;
        if (table === 'partidas') queryClient.invalidateQueries({ queryKey: ['matches'] });
        if (table === 'cartelas_jogador') {
          queryClient.invalidateQueries({ queryKey: ['playerCards'] });
          queryClient.invalidateQueries({ queryKey: ['allPlayerCards'] });
        }
        if (table === 'cartelas_partida') queryClient.invalidateQueries({ queryKey: ['matchCards'] });
        if (table === 'perfis') {
          queryClient.invalidateQueries({ queryKey: ['profile'] });
          queryClient.invalidateQueries({ queryKey: ['players'] });
        }
        if (table === 'vitorias') {
          queryClient.invalidateQueries({ queryKey: ['wins'] });
          queryClient.invalidateQueries({ queryKey: ['allWins'] });
        }
        if (table === 'solicitacoes_credito') {
          queryClient.invalidateQueries({ queryKey: ['creditRequests'] });
          queryClient.invalidateQueries({ queryKey: ['allCreditRequests'] });
        }
        if (table === 'configuracoes') queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const createMatch = async (data: any) => {
    const { error } = await supabase.from('partidas').insert([{ ...data, status: 'waiting' }]);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Partida criada com sucesso!");
    }
  };

  const updateMatchStatus = async (matchId: string, status: MatchStatus) => {
    const { error } = await supabase.from('partidas').update({ status }).eq('id', matchId);
    if (error) toast.error(error.message);
  };

  const openMatch = (matchId: string) => updateMatchStatus(matchId, 'open');
  const startMatch = (matchId: string) => updateMatchStatus(matchId, 'in_progress');
  const finishMatch = (matchId: string) => updateMatchStatus(matchId, 'finished');

  const deleteMatch = async (matchId: string) => {
    const { error } = await supabase.from('partidas').delete().eq('id', matchId);
    if (error) toast.error(error.message);
    else toast.success("Partida excluída.");
  };

  const toggleAutoCall = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !gameSettings) return;
    const isEnabling = !match.is_auto_calling;
    const { error } = await supabase.from('partidas').update({
      is_auto_calling: isEnabling,
      next_auto_call_timestamp: isEnabling ? new Date(Date.now() + gameSettings.intervalo_sorteio_auto_seg * 1000).toISOString() : null,
    }).eq('id', matchId);
    if (error) toast.error(error.message);
  };

  const callNumber = async (matchId: string, num: number) => {
    const { error } = await supabase.functions.invoke('call-number', { body: { matchId, num } });
    if (error) toast.error(`Erro ao sortear número: ${error.message}`);
  };

  const requestCredits = async (file: File, creditsRequested: number, amountPaid: number): Promise<boolean> => {
    if (!user || !profile) return false;
    const fileName = `${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
    if (uploadError) { toast.error(uploadError.message); return false; }

    const { data: newRequest, error: insertError } = await supabase.from('solicitacoes_credito').insert({ 
      player_id: user.id, receipt_url: fileName, status: 'pending', credits_requested: creditsRequested, amount_paid: amountPaid,
    }).select().single();

    if (insertError) { toast.error(insertError.message); return false; }
    
    await supabase.functions.invoke('notify-n8n', {
      body: { event: 'CREDIT_REQUEST', data: { requestId: newRequest.id, creditsRequested, amountPaid, userEmail: user.email } }
    });
    return true;
  };

  const resolveCreditRequest = async (requestId: string, status: 'approved' | 'rejected', creditsGranted?: number, notes?: string): Promise<boolean> => {
    if (!profile || profile.role !== 'admin' || !user) return false;
    const request = allCreditRequests.find(r => r.id === requestId);
    if (!request) return false;

    if (status === 'approved') {
      if (creditsGranted === undefined || creditsGranted < 0) {
        toast.error("Informe um valor válido.");
        return false;
      }
      await updatePlayerCredits(request.player_id, creditsGranted);
    }

    const { error } = await supabase.from('solicitacoes_credito').update({
      status, credits_granted: status === 'approved' ? creditsGranted : null,
      resolved_at: new Date().toISOString(), resolved_by: user.id, notes: notes || null,
    }).eq('id', requestId);

    if (error) { toast.error(error.message); return false; }
    toast.success(`Solicitação processada.`);
    return true;
  };

  const deleteCreditRequest = async (requestId: string) => {
    const { error } = await supabase.from('solicitacoes_credito').delete().eq('id', requestId);
    if (error) toast.error(error.message);
    else toast.success("Solicitação excluída.");
  };

  const updatePlayerCredits = async (playerId: string, amount: number) => {
    const { data: p } = await supabase.from('perfis').select('credits').eq('id', playerId).single();
    if (!p) return;
    const { error } = await supabase.from('perfis').update({ credits: p.credits + amount }).eq('id', playerId);
    if (error) toast.error(error.message);
  };

  const createPlayerCard = async (options: { name: string; numbers: number[][]; }): Promise<PlayerCard | null> => {
    if (!user || !profile || !gameSettings || profile.credits < gameSettings.custo_nova_cartela) return null;
    const { error: creditError } = await supabase.from('perfis').update({ credits: profile.credits - gameSettings.custo_nova_cartela }).eq('id', user.id);
    if (creditError) return null;
    const { data, error } = await supabase.from('cartelas_jogador').insert({ player_id: user.id, ...options, uses_left: 1 }).select().single();
    return error ? null : data as PlayerCard;
  };

  const deletePlayerCard = async (cardId: string) => {
    const { error } = await supabase.from('cartelas_jogador').delete().eq('id', cardId);
    if (error) toast.error(error.message);
  };

  const toggleArchivePlayerCard = async (cardId: string, archive: boolean) => {
    const { error } = await supabase.from('cartelas_jogador').update({ is_archived: archive }).eq('id', cardId);
    if (error) toast.error(error.message);
  };

  const joinMatch = async (matchId: string, playerCardIds: string[]): Promise<MatchCard[] | null> => {
    const { data, error } = await supabase.functions.invoke('join-match', { body: { matchId, playerCardIds } });
    return error ? null : data as MatchCard[];
  };

  const buyCardUses = async (playerCardId: string): Promise<boolean> => {
    if (!profile || !gameSettings || profile.credits < gameSettings.custo_recarga_cartela) return false;
    await supabase.from('perfis').update({ credits: profile.credits - gameSettings.custo_recarga_cartela }).eq('id', profile.id);
    const card = playerCards.find(c => c.id === playerCardId);
    if (card) await supabase.from('cartelas_jogador').update({ uses_left: card.uses_left + gameSettings.usos_por_recarga }).eq('id', playerCardId);
    return true;
  };

  const updateGameSettings = async (newSettings: Partial<GameSettings>) => {
    const { error } = await supabase.from('configuracoes').update(newSettings).eq('singleton', true);
    if (error) toast.error(error.message);
    else toast.success("Salvo!");
  };

  const getMatchCards = (matchId: string) => matchCards.filter(c => c.match_id === matchId);
  const getPlayerMatchCards = (matchId: string, playerId: string) => matchCards.filter(c => c.match_id === matchId && c.player_id === playerId);

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7;

  return (
    <GameContext.Provider value={{
      matches, players, playerCards, allPlayerCards, matchCards, wins, allWins, creditRequests, allCreditRequests, gameSettings, isLoading,
      createMatch, openMatch, startMatch, callNumber, finishMatch, deleteMatch, toggleAutoCall,
      updateGameSettings, createPlayerCard, deletePlayerCard, toggleArchivePlayerCard, joinMatch, buyCardUses,
      requestCredits, resolveCreditRequest, deleteCreditRequest, updatePlayerCredits, getMatchCards, getPlayerMatchCards,
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider');
  return context;
};