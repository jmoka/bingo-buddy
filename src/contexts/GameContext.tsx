import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Match, PlayerCard, MatchCard, Win, MatchStatus, CreditRequest, CreditRequestMessage } from '@/types/match';
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
  resubmitCreditRequest: (requestId: string, file: File, message: string) => Promise<boolean>;
  resolveCreditRequest: (requestId: string, status: 'approved' | 'rejected', creditsGranted?: number, notes?: string) => Promise<boolean>;
  unblockCreditRequest: (requestId: string) => Promise<void>;
  deleteCreditRequest: (requestId: string) => Promise<void>;
  updatePlayerCredits: (playerId: string, amount: number) => Promise<void>;
  getMatchCards: (matchId: string) => MatchCard[];
  getPlayerMatchCards: (matchId: string, playerId: string) => MatchCard[];
  fetchRequestMessages: (requestId: string) => Promise<CreditRequestMessage[]>;
}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = profile?.role === 'admin';

  const { data: gameSettings } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracoes').select('*').limit(1).single();
      if (error) return { custo_nova_cartela: 10, custo_recarga_cartela: 5, usos_por_recarga: 1, intervalo_sorteio_auto_seg: 120, valor_por_credito: 1 } as GameSettings;
      return data as GameSettings;
    }
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('partidas').select('*').order('start_time', { ascending: false });
      if (error) throw error;
      return data as Match[];
    },
  });

  const { data: playerCards = [] } = useQuery({
    queryKey: ['playerCards', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('cartelas_jogador').select('*').eq('player_id', user.id);
      if (error) throw error;
      return data as PlayerCard[];
    },
    enabled: !!user,
  });

  const { data: matchCards = [] } = useQuery({
    queryKey: ['matchCards'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartelas_partida').select('*');
      if (error) throw error;
      return data.map(c => ({ ...c, marked_numbers: new Set(c.marked_numbers || []) })) as MatchCard[];
    },
  });

  const { data: wins = [] } = useQuery({
    queryKey: ['wins', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('vitorias').select('*').eq('player_id', user.id);
      return data as Win[];
    },
    enabled: !!user,
  });

  const { data: creditRequests = [] } = useQuery({
    queryKey: ['creditRequests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('solicitacoes_credito').select('*').eq('player_id', user.id).order('requested_at', { ascending: false });
      return data as CreditRequest[];
    },
    enabled: !!user,
  });

  const { data: players = [], isLoading: isLoadingPlayers } = useQuery({
    queryKey: ['players', isAdmin],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data, error } = await supabase.from('perfis').select('*');
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isAdmin,
  });

  const { data: allPlayerCards = [] } = useQuery({
    queryKey: ['allPlayerCards', isAdmin],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data, error } = await supabase.from('cartelas_jogador').select('*');
      if (error) throw error;
      return data as PlayerCard[];
    },
    enabled: isAdmin,
  });

  const { data: allWins = [] } = useQuery({
    queryKey: ['allWins', isAdmin],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data, error } = await supabase.from('vitorias').select('*');
      if (error) throw error;
      return data as Win[];
    },
    enabled: isAdmin,
  });

  const { data: rawCreditRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ['rawCreditRequests', isAdmin],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data, error } = await supabase.from('solicitacoes_credito').select('*').order('requested_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const allCreditRequests = useMemo(() => {
    if (!isAdmin || !rawCreditRequests || !players) return [];
    const playersMap = new Map(players.map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
    return rawCreditRequests.map(req => ({
      ...req,
      perfis: playersMap.get(req.player_id) || null
    })) as CreditRequest[];
  }, [isAdmin, rawCreditRequests, players]);

  useEffect(() => {
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        queryClient.invalidateQueries();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const createMatch = async (data: any) => {
    const { error } = await supabase.from('partidas').insert([{ ...data, status: 'waiting' }]);
    if (error) toast.error(error.message);
  };

  const updateMatchStatus = async (matchId: string, status: MatchStatus) => {
    await supabase.from('partidas').update({ status }).eq('id', matchId);
  };

  const openMatch = (matchId: string) => updateMatchStatus(matchId, 'open');
  const startMatch = (matchId: string) => updateMatchStatus(matchId, 'in_progress');
  const finishMatch = (matchId: string) => updateMatchStatus(matchId, 'finished');
  const deleteMatch = async (matchId: string) => { await supabase.from('partidas').delete().eq('id', matchId); };

  const toggleAutoCall = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !gameSettings) return;
    const isEnabling = !match.is_auto_calling;
    await supabase.from('partidas').update({
      is_auto_calling: isEnabling,
      next_auto_call_timestamp: isEnabling ? new Date(Date.now() + gameSettings.intervalo_sorteio_auto_seg * 1000).toISOString() : null,
    }).eq('id', matchId);
  };

  const callNumber = async (matchId: string, num: number) => {
    await supabase.functions.invoke('call-number', { body: { matchId, num } });
  };

  const requestCredits = async (file: File, creditsRequested: number, amountPaid: number): Promise<boolean> => {
    if (!user) return false;
    const fileName = `${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    await supabase.storage.from('receipts').upload(fileName, file);
    const { data: newRequest, error } = await supabase.from('solicitacoes_credito').insert({ 
      player_id: user.id, receipt_url: fileName, status: 'pending', credits_requested: creditsRequested, amount_paid: amountPaid,
    }).select().single();
    if (error) return false;
    
    await supabase.from('mensagens_solicitacao').insert({
        credit_request_id: newRequest.id,
        sender_id: user.id,
        message: `Nova solicitação: ${creditsRequested} créditos. Valor pago: R$ ${amountPaid.toFixed(2)}`
    });

    queryClient.invalidateQueries({ queryKey: ['creditRequests'] });
    queryClient.invalidateQueries({ queryKey: ['rawCreditRequests'] });

    await supabase.functions.invoke('notify-n8n', { body: { event: 'CREDIT_REQUEST', data: { requestId: newRequest.id, creditsRequested, amountPaid, userEmail: user.email } } });
    return true;
  };

  const resubmitCreditRequest = async (requestId: string, file: File, message: string): Promise<boolean> => {
    if (!user) return false;
    const fileName = `${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    
    const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
    if (uploadError) { toast.error('Erro ao enviar comprovante.', { description: uploadError.message }); return false; }

    const { error } = await supabase.from('solicitacoes_credito').update({
      status: 'pending', receipt_url: fileName, resubmission_notes: message, resolved_at: null, resolved_by: null, notes: null, credits_granted: null,
    }).eq('id', requestId);

    if (error) {
      toast.error('Falha ao reenviar solicitação.', { description: error.message });
      await supabase.storage.from('receipts').remove([fileName]);
      return false;
    }

    await supabase.from('mensagens_solicitacao').insert({ credit_request_id: requestId, sender_id: user.id, message: message || "Reenvio de comprovante." });

    queryClient.invalidateQueries({ queryKey: ['creditRequests'] });
    queryClient.invalidateQueries({ queryKey: ['rawCreditRequests'] });

    await supabase.functions.invoke('notify-n8n', { body: { event: 'CREDIT_RESUBMISSION', data: { requestId, userEmail: user.email, message } } });
    return true;
  };

  const resolveCreditRequest = async (requestId: string, status: 'approved' | 'rejected', creditsGranted?: number, notes?: string): Promise<boolean> => {
    if (!profile || profile.role !== 'admin' || !user) return false;
    
    const request = allCreditRequests.find(r => r.id === requestId);
    if (!request) return false;

    if (status === 'approved' && creditsGranted !== undefined) {
      await updatePlayerCredits(request.player_id, creditsGranted);
    }
    
    await supabase.from('solicitacoes_credito').update({
      status, credits_granted: status === 'approved' ? creditsGranted : null,
      resolved_at: new Date().toISOString(), resolved_by: user.id, notes: notes || null,
    }).eq('id', requestId);

    if (notes) {
        await supabase.from('mensagens_solicitacao').insert({
            credit_request_id: requestId,
            sender_id: user.id,
            message: notes
        });
    }

    // Invalidar caches para atualizar a UI do admin e do jogador instantaneamente
    queryClient.invalidateQueries({ queryKey: ['rawCreditRequests'] });
    queryClient.invalidateQueries({ queryKey: ['creditRequests'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['players'] });
    
    return true;
  };

  const unblockCreditRequest = async (requestId: string) => {
    await supabase.from('solicitacoes_credito').update({
      status: 'pending', notes: 'Solicitação reaberta pelo administrador.', resolved_at: null, resolved_by: null, credits_granted: null,
    }).eq('id', requestId);
    queryClient.invalidateQueries({ queryKey: ['rawCreditRequests'] });
    queryClient.invalidateQueries({ queryKey: ['creditRequests'] });
    toast.success('Solicitação reaberta');
  };

  const deleteCreditRequest = async (requestId: string) => { 
    await supabase.from('solicitacoes_credito').delete().eq('id', requestId); 
    queryClient.invalidateQueries({ queryKey: ['rawCreditRequests'] });
    queryClient.invalidateQueries({ queryKey: ['creditRequests'] });
  };

  const updatePlayerCredits = async (playerId: string, amount: number) => {
    const { data: p } = await supabase.from('perfis').select('credits').eq('id', playerId).single();
    if (p) await supabase.from('perfis').update({ credits: p.credits + amount }).eq('id', playerId);
  };

  const createPlayerCard = async (options: { name: string; numbers: number[][]; }): Promise<PlayerCard | null> => {
    if (!user || !profile || !gameSettings || profile.credits < gameSettings.custo_nova_cartela) return null;
    await supabase.from('perfis').update({ credits: profile.credits - gameSettings.custo_nova_cartela }).eq('id', user.id);
    const { data } = await supabase.from('cartelas_jogador').insert({ player_id: user.id, ...options, uses_left: 1 }).select().single();
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return data as PlayerCard;
  };

  const deletePlayerCard = async (cardId: string) => { await supabase.from('cartelas_jogador').delete().eq('id', cardId); };
  const toggleArchivePlayerCard = async (cardId: string, archive: boolean) => { await supabase.from('cartelas_jogador').update({ is_archived: archive }).eq('id', cardId); };

  const joinMatch = async (matchId: string, playerCardIds: string[]): Promise<MatchCard[] | null> => {
    const { data } = await supabase.functions.invoke('join-match', { body: { matchId, playerCardIds } });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return data as MatchCard[];
  };

  const buyCardUses = async (playerCardId: string): Promise<boolean> => {
    if (!profile || !gameSettings || profile.credits < gameSettings.custo_recarga_cartela) return false;
    await supabase.from('perfis').update({ credits: profile.credits - gameSettings.custo_recarga_cartela }).eq('id', profile.id);
    const card = playerCards.find(c => c.id === playerCardId);
    if (card) await supabase.from('cartelas_jogador').update({ uses_left: card.uses_left + gameSettings.usos_por_recarga }).eq('id', playerCardId);
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return true;
  };

  const updateGameSettings = async (newSettings: Partial<GameSettings>) => { await supabase.from('configuracoes').update(newSettings).eq('singleton', true); };
  const getMatchCards = (matchId: string) => matchCards.filter(c => c.match_id === matchId);
  const getPlayerMatchCards = (matchId: string, playerId: string) => matchCards.filter(c => c.match_id === matchId && c.player_id === playerId);

  const fetchRequestMessages = async (requestId: string): Promise<CreditRequestMessage[]> => {
    const { data, error } = await supabase.from('mensagens_solicitacao').select('*').eq('credit_request_id', requestId).order('created_at', { ascending: true });
    if (error) return [];
    return data as CreditRequestMessage[];
  };

  return (
    <GameContext.Provider value={{
      matches, players, playerCards, allPlayerCards, matchCards, wins, allWins, creditRequests, allCreditRequests, gameSettings, isLoading: isLoadingRequests || (isAdmin && isLoadingPlayers),
      createMatch, openMatch, startMatch, callNumber, finishMatch, deleteMatch, toggleAutoCall,
      updateGameSettings, createPlayerCard, deletePlayerCard, toggleArchivePlayerCard, joinMatch, buyCardUses,
      requestCredits, resubmitCreditRequest, resolveCreditRequest, unblockCreditRequest, deleteCreditRequest, updatePlayerCredits, getMatchCards, getPlayerMatchCards,
      fetchRequestMessages
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