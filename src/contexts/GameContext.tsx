import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Match, PlayerCard, MatchCard, Win, MatchStatus, CreditRequest, CreditRequestMessage, RedeemRequest, RedeemRequestMessage, CreditType } from '@/types/match';
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
  redeemRequests: RedeemRequest[];
  allRedeemRequests: RedeemRequest[];
  gameSettings: GameSettings | undefined;
  isLoading: boolean;
  createMatch: (data: any) => Promise<void>;
  updateMatch: (matchId: string, data: Partial<Match>) => Promise<void>;
  openMatch: (matchId: string) => Promise<void>;
  startMatch: (matchId: string) => Promise<void>;
  callNumber: (matchId: string, num: number) => Promise<void>;
  finishMatch: (matchId: string) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  toggleAutoCall: (matchId: string) => Promise<void>;
  updateGameSettings: (newSettings: Partial<GameSettings>) => Promise<void>;
  createPlayerCard: (options: { name: string; numbers: number[][]; creditType: CreditType; }) => Promise<PlayerCard | null>;
  deletePlayerCard: (cardId: string) => Promise<void>;
  toggleArchivePlayerCard: (cardId: string, archive: boolean) => Promise<void>;
  joinMatch: (matchId: string, playerCardIds: string[]) => Promise<MatchCard[] | null>;
  buyCardUses: (playerCardId: string, creditType: CreditType) => Promise<boolean>;
  renewFakeCredits: () => Promise<void>;
  requestCredits: (file: File, creditsRequested: number, amountPaid: number) => Promise<boolean>;
  resubmitCreditRequest: (requestId: string, file: File, message: string) => Promise<boolean>;
  resolveCreditRequest: (requestId: string, status: 'approved' | 'rejected', creditsGranted?: number, notes?: string) => Promise<boolean>;
  unblockCreditRequest: (requestId: string) => Promise<void>;
  deleteCreditRequest: (requestId: string) => Promise<void>;
  // Resgates
  requestRedeem: (credits: number, amount: number, message?: string) => Promise<boolean>;
  resubmitRedeemRequest: (requestId: string, message: string) => Promise<boolean>;
  resolveRedeemRequest: (requestId: string, status: 'approved' | 'rejected', receiptFile?: File, notes?: string) => Promise<boolean>;
  unblockRedeemRequest: (requestId: string) => Promise<void>;
  deleteRedeemRequest: (requestId: string) => Promise<void>;
  updatePlayerCredits: (playerId: string, amount: number) => Promise<void>;
  cleanupMatchDuplicates: (matchId: string) => Promise<void>;
  getMatchCards: (matchId: string) => MatchCard[];
  getPlayerMatchCards: (matchId: string, playerId: string) => MatchCard[];
  fetchRequestMessages: (requestId: string) => Promise<CreditRequestMessage[]>;
  fetchRedeemMessages: (requestId: string) => Promise<RedeemRequestMessage[]>;
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

  const { data: redeemRequests = [] } = useQuery({
    queryKey: ['redeemRequests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('solicitacoes_resgate').select('*').eq('player_id', user.id).order('requested_at', { ascending: false });
      return data as RedeemRequest[];
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

  const { data: rawRedeemRequests = [], isLoading: isLoadingRedeems } = useQuery({
    queryKey: ['rawRedeemRequests', isAdmin],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data, error } = await supabase.from('solicitacoes_resgate').select('*').order('requested_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const allRedeemRequests = useMemo(() => {
    if (!isAdmin || !rawRedeemRequests || !players) return [];
    const playersMap = new Map(players.map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
    return rawRedeemRequests.map(req => ({
      ...req,
      perfis: playersMap.get(req.player_id) || null
    })) as RedeemRequest[];
  }, [isAdmin, rawRedeemRequests, players]);

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
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Partida criada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    }
  };

  const updateMatch = async (matchId: string, data: Partial<Match>) => {
    const { error } = await supabase.from('partidas').update(data).eq('id', matchId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Partida atualizada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    }
  };

  const updateMatchStatus = async (matchId: string, status: MatchStatus) => {
    const { error } = await supabase.from('partidas').update({ status }).eq('id', matchId);
    if (error) {
      toast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    }
  };

  const openMatch = (matchId: string) => updateMatchStatus(matchId, 'open');
  
  const startMatch = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const playersInMatch = new Set(matchCards.filter(mc => mc.match_id === matchId).map(mc => mc.player_id)).size;

    if (match.min_players > 1 && playersInMatch < match.min_players) {
      toast.error('A partida não pode ser iniciada.', {
        description: `São necessários no mínimo ${match.min_players} jogadores, mas há apenas ${playersInMatch}.`
      });
      return;
    }
    
    await updateMatchStatus(matchId, 'in_progress');
  };

  const finishMatch = (matchId: string) => updateMatchStatus(matchId, 'finished');
  
  const deleteMatch = async (matchId: string) => {
    const { error } = await supabase.from('partidas').delete().eq('id', matchId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Partida excluída.');
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    }
  };

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

    queryClient.invalidateQueries({ queryKey: ['rawCreditRequests'] });
    queryClient.invalidateQueries({ queryKey: ['creditRequests'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['players'] });
    
    return true;
  };

  // Funções de Resgate
  const requestRedeem = async (credits: number, amount: number, message?: string): Promise<boolean> => {
    if (!user || !profile || profile.credits < credits) {
        toast.error('Créditos insuficientes!');
        return false;
    }

    // Debita imediatamente
    await updatePlayerCredits(user.id, -credits);

    const { data: newRequest, error } = await supabase.from('solicitacoes_resgate').insert({
        player_id: user.id,
        credits_requested: credits,
        amount_to_receive: amount,
        status: 'pending'
    }).select().single();

    if (error) {
        // Estorna em caso de erro na criação da solicitação
        await updatePlayerCredits(user.id, credits);
        toast.error(error.message);
        return false;
    }

    await supabase.from('mensagens_resgate').insert({
        redeem_request_id: newRequest.id,
        sender_id: user.id,
        message: message || `Nova solicitação de resgate: ${credits} créditos. Valor a receber: R$ ${amount.toFixed(2)}`
    });

    queryClient.invalidateQueries({ queryKey: ['redeemRequests'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    
    await supabase.functions.invoke('notify-n8n', { body: { event: 'REDEEM_REQUEST', data: { requestId: newRequest.id, credits, amount, userEmail: user.email } } });
    return true;
  };

  const resubmitRedeemRequest = async (requestId: string, message: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from('solicitacoes_resgate').update({
        status: 'pending', resubmission_notes: message, resolved_at: null, resolved_by: null, notes: null
    }).eq('id', requestId);

    if (error) {
        toast.error('Falha ao reenviar solicitação.', { description: error.message });
        return false;
    }

    await supabase.from('mensagens_resgate').insert({ redeem_request_id: requestId, sender_id: user.id, message });
    
    queryClient.invalidateQueries({ queryKey: ['redeemRequests'] });
    queryClient.invalidateQueries({ queryKey: ['rawRedeemRequests'] });

    await supabase.functions.invoke('notify-n8n', { body: { event: 'REDEEM_RESUBMISSION', data: { requestId, userEmail: user.email, message } } });
    
    return true;
  };

  const resolveRedeemRequest = async (requestId: string, status: 'approved' | 'rejected', receiptFile?: File, notes?: string): Promise<boolean> => {
    if (!profile || profile.role !== 'admin' || !user) return false;
    const request = allRedeemRequests.find(r => r.id === requestId);
    if (!request) return false;

    let receiptPath = null;
    if (status === 'approved' && receiptFile) {
        const fileName = `redeems/${requestId}/${Date.now()}.${receiptFile.name.split('.').pop()}`;
        await supabase.storage.from('receipts').upload(fileName, receiptFile);
        receiptPath = fileName;
    }

    if (status === 'rejected') {
        await updatePlayerCredits(request.player_id, request.credits_requested);
        toast.info(`${request.credits_requested} créditos foram estornados para o jogador.`);
    }

    await supabase.from('solicitacoes_resgate').update({
        status, receipt_url: receiptPath, notes: notes || null, resolved_at: new Date().toISOString(), resolved_by: user.id
    }).eq('id', requestId);

    if (notes) {
        await supabase.from('mensagens_resgate').insert({ redeem_request_id: requestId, sender_id: user.id, message: notes });
    }

    queryClient.invalidateQueries({ queryKey: ['rawRedeemRequests'] });
    queryClient.invalidateQueries({ queryKey: ['redeemRequests'] });
    queryClient.invalidateQueries({ queryKey: ['players'] });
    return true;
  };

  const unblockRedeemRequest = async (requestId: string) => {
    const request = allRedeemRequests.find(r => r.id === requestId);
    if (!request) return;

    await updatePlayerCredits(request.player_id, -request.credits_requested);
    toast.info(`${request.credits_requested} créditos foram debitados novamente para reanálise.`);

    await supabase.from('solicitacoes_resgate').update({
        status: 'pending',
        notes: 'Solicitação reaberta pelo administrador.',
        resolved_at: null,
        resolved_by: null,
    }).eq('id', requestId);

    queryClient.invalidateQueries({ queryKey: ['rawRedeemRequests'] });
    queryClient.invalidateQueries({ queryKey: ['redeemRequests'] });
    queryClient.invalidateQueries({ queryKey: ['players'] });
    toast.success('Solicitação de resgate reaberta.');
  };

  const deleteRedeemRequest = async (requestId: string) => {
    await supabase.from('solicitacoes_resgate').delete().eq('id', requestId);
    queryClient.invalidateQueries({ queryKey: ['rawRedeemRequests'] });
    queryClient.invalidateQueries({ queryKey: ['redeemRequests'] });
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

  const createPlayerCard = async (options: { name: string; numbers: number[][]; creditType: CreditType; }) => {
    if (!user || !profile || !gameSettings) return null;
    
    const cost = gameSettings.custo_nova_cartela;
    const { creditType, ...cardData } = options;

    // Debit credits first
    if (creditType === 'real') {
      if (profile.credits < cost) { toast.error('Créditos reais insuficientes.'); return null; }
      const { error: creditError } = await supabase.from('perfis').update({ credits: profile.credits - cost }).eq('id', user.id);
      if (creditError) {
        toast.error('Erro ao debitar créditos.', { description: creditError.message });
        return null;
      }
    } else {
      if (profile.fake_credits < cost) { toast.error('Créditos de brincar insuficientes.'); return null; }
      const { error: creditError } = await supabase.from('perfis').update({ fake_credits: profile.fake_credits - cost }).eq('id', user.id);
      if (creditError) {
        toast.error('Erro ao debitar créditos de brincar.', { description: creditError.message });
        return null;
      }
    }

    // Then insert the card
    const { data, error: insertError } = await supabase.from('cartelas_jogador').insert({ player_id: user.id, ...cardData, credit_type: creditType, uses_left: 1 }).select().single();
    
    if (insertError) {
      toast.error('Erro ao criar a cartela.', { description: insertError.message });
      // Rollback credit deduction
      if (creditType === 'real') {
        await supabase.from('perfis').update({ credits: profile.credits }).eq('id', user.id);
      } else {
        await supabase.from('perfis').update({ fake_credits: profile.fake_credits }).eq('id', user.id);
      }
      return null;
    }

    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['playerCards', user?.id] });
    return data as PlayerCard;
  };

  const deletePlayerCard = async (cardId: string) => { await supabase.from('cartelas_jogador').delete().eq('id', cardId); };
  const toggleArchivePlayerCard = async (cardId: string, archive: boolean) => { await supabase.from('cartelas_jogador').update({ is_archived: archive }).eq('id', cardId); };

  const joinMatch = async (matchId: string, playerCardIds: string[]) => {
    const { data } = await supabase.functions.invoke('join-match', { body: { matchId, playerCardIds } });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return data as MatchCard[];
  };

  const buyCardUses = async (playerCardId: string, creditType: CreditType) => {
    if (!profile || !gameSettings) return false;
    
    const cost = gameSettings.custo_recarga_cartela;
    
    if (creditType === 'real') {
      if (profile.credits < cost) { toast.error('Créditos reais insuficientes.'); return false; }
      await supabase.from('perfis').update({ credits: profile.credits - cost }).eq('id', profile.id);
    } else {
      if (profile.fake_credits < cost) { toast.error('Créditos de brincar insuficientes.'); return false; }
      await supabase.from('perfis').update({ fake_credits: profile.fake_credits - cost }).eq('id', profile.id);
    }

    const card = playerCards.find(c => c.id === playerCardId);
    if (card) await supabase.from('cartelas_jogador').update({ uses_left: card.uses_left + gameSettings.usos_por_recarga }).eq('id', playerCardId);
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return true;
  };

  const renewFakeCredits = async () => {
    if (!user) return;
    await supabase.from('perfis').update({ fake_credits: 100 }).eq('id', user.id);
    toast.success('Seu saldo de brincar foi renovado!');
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };

  const updateGameSettings = async (newSettings: Partial<GameSettings>) => { await supabase.from('configuracoes').update(newSettings).eq('singleton', true); };
  
  const cleanupMatchDuplicates = async (matchId: string) => {
    const { data, error } = await supabase.functions.invoke('cleanup-duplicates', {
        body: { matchId },
    });

    if (error) {
        toast.error('Falha na limpeza', { description: error.message });
        return;
    }

    if (data.cards_deleted > 0) {
      toast.success('Limpeza de duplicatas concluída!', {
          description: `${data.cards_deleted} cartelas duplicadas removidas. ${data.credits_refunded} créditos estornados.`,
      });
    } else {
      toast.info('Nenhuma duplicata encontrada.', {
        description: 'A partida já estava correta.'
      });
    }
    queryClient.invalidateQueries();
  };

  const getMatchCards = (matchId: string) => matchCards.filter(c => c.match_id === matchId);
  const getPlayerMatchCards = (matchId: string, playerId: string) => matchCards.filter(c => c.match_id === matchId && c.player_id === playerId);

  const fetchRequestMessages = async (requestId: string) => {
    const { data, error } = await supabase.from('mensagens_solicitacao').select('*').eq('credit_request_id', requestId).order('created_at', { ascending: true });
    if (error) return [];
    return data as CreditRequestMessage[];
  };

  const fetchRedeemMessages = async (requestId: string) => {
    const { data, error } = await supabase.from('mensagens_resgate').select('*').eq('redeem_request_id', requestId).order('created_at', { ascending: true });
    if (error) return [];
    return data as RedeemRequestMessage[];
  };

  return (
    <GameContext.Provider value={{
      matches, players, playerCards, allPlayerCards, matchCards, wins, allWins, creditRequests, allCreditRequests, 
      redeemRequests, allRedeemRequests, gameSettings, isLoading: isLoadingRequests || isLoadingRedeems || (isAdmin && isLoadingPlayers),
      createMatch, updateMatch, openMatch, startMatch, callNumber, finishMatch, deleteMatch, toggleAutoCall,
      updateGameSettings, createPlayerCard, deletePlayerCard, toggleArchivePlayerCard, joinMatch, buyCardUses, renewFakeCredits,
      requestCredits, resubmitCreditRequest, resolveCreditRequest, unblockCreditRequest, deleteCreditRequest, 
      requestRedeem, resubmitRedeemRequest, resolveRedeemRequest, unblockRedeemRequest, deleteRedeemRequest, 
      cleanupMatchDuplicates, getMatchCards, getPlayerMatchCards, fetchRequestMessages, fetchRedeemMessages
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