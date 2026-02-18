import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Match, PlayerCard, MatchCard, Win, MatchStatus, CreditRequest, CreditRequestMessage, RedeemRequest, RedeemRequestMessage } from '@/types/match';
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
  startMatch: (matchId: string, force?: boolean) => Promise<void>;
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
  // Resgates
  requestRedeem: (credits: number, amount: number, message?: string) => Promise<boolean>;
  resubmitRedeemRequest: (requestId: string, message: string) => Promise<boolean>;
  resolveRedeemRequest: (requestId: string, status: 'approved' | 'rejected', receiptFile?: File, notes?: string) => Promise<boolean>;
  unblockRedeemRequest: (requestId: string) => Promise<void>;
  deleteRedeemRequest: (requestId: string) => Promise<void>;
  updatePlayerCredits: (playerId: string, amount: number) => Promise<boolean>;
  getMatchCards: (matchId: string) => MatchCard[];
  getPlayerMatchCards: (matchId: string, playerId: string) => MatchCard[];
  fetchRequestMessages: (requestId: string) => Promise<CreditRequestMessage[]>;
  fetchRedeemMessages: (requestId: string) => Promise<RedeemRequestMessage[]>;
}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const processingRef = useRef(new Set());

  const isAdmin = profile?.role === 'admin';

  // Timer for countdowns and auto-actions
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000); // Update every second
    return () => clearInterval(timer);
  }, []);

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

  // Effect for auto-starting and auto-calling
  useEffect(() => {
    matches.forEach(match => {
      // Auto-start logic
      if (
        match.is_auto_calling &&
        match.status === 'open' &&
        now >= new Date(match.start_time).getTime()
      ) {
        const processingKey = `start_${match.id}`;
        if (processingRef.current.has(processingKey)) return;
        processingRef.current.add(processingKey);
        console.log(`Automatically starting match: ${match.name} (${match.id})`);
        startMatch(match.id, true); // Force start, ignoring min players
      }

      // Auto-call logic
      if (
        match.is_auto_calling &&
        match.status === 'in_progress' &&
        match.next_auto_call_timestamp &&
        now >= new Date(match.next_auto_call_timestamp).getTime()
      ) {
        const processingKey = `call_${match.id}`;
        if (processingRef.current.has(processingKey)) return;
        processingRef.current.add(processingKey);
        
        const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(num => !match.called_numbers.includes(num));
        if (availableNumbers.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableNumbers.length);
          callNumber(match.id, availableNumbers[randomIndex]);
        } else {
          toggleAutoCall(match.id); // Turn off if no numbers left
        }
        setTimeout(() => processingRef.current.delete(processingKey), 1000);
      }
    });
  }, [now, matches]);

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
    const status = data.is_auto_calling ? 'open' : 'waiting';
    const { error } = await supabase.from('partidas').insert([{ ...data, status }]);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Partida criada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    }
  };

  const updateMatch = async (matchId: string, data: Partial<Match>) => {
    const matchToUpdate = matches.find(m => m.id === matchId);
    if (!matchToUpdate) return;
  
    const updatedData = { ...data };
  
    // If toggling auto-calling on for a waiting match, open it.
    if (data.is_auto_calling && matchToUpdate.status === 'waiting') {
      updatedData.status = 'open';
    }
  
    const { error } = await supabase.from('partidas').update(updatedData).eq('id', matchId);
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
  
  const startMatch = async (matchId: string, force = false) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const playersInMatch = new Set(matchCards.filter(mc => mc.match_id === matchId).map(mc => mc.player_id)).size;

    if (!force && playersInMatch < match.min_players) {
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
    await queryClient.cancelQueries({ queryKey: ['matches'] });
    await queryClient.cancelQueries({ queryKey: ['matchCards'] });

    const previousMatches = queryClient.getQueryData<Match[]>(['matches']);
    const previousMatchCards = queryClient.getQueryData<MatchCard[]>(['matchCards']);

    queryClient.setQueryData<Match[]>(['matches'], (old) =>
      old
        ? old.map((match) =>
            match.id === matchId
              ? { ...match, called_numbers: [...match.called_numbers, num] }
              : match
          )
        : []
    );

    queryClient.setQueryData<MatchCard[]>(['matchCards'], (old) =>
      old
        ? old.map((card) => {
            if (card.match_id === matchId && card.numbers.flat().includes(num)) {
              const newMarkedNumbers = new Set(card.marked_numbers);
              newMarkedNumbers.add(num);
              return { ...card, marked_numbers: newMarkedNumbers };
            }
            return card;
          })
        : []
    );

    try {
      const { error } = await supabase.functions.invoke('call-number', { body: { matchId, num } });
      if (error) throw error;
    } catch (error) {
      toast.error("Erro ao sortear número.", { description: (error as Error).message });
      queryClient.setQueryData(['matches'], previousMatches);
      queryClient.setQueryData(['matchCards'], previousMatchCards);
    }
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

  const updatePlayerCredits = async (playerId: string, amount: number): Promise<boolean> => {
    const { data: p, error: fetchError } = await supabase.from('perfis').select('credits').eq('id', playerId).single();
    if (fetchError || !p) {
        toast.error("Erro ao buscar perfil do jogador.", { description: fetchError?.message });
        return false;
    }
    
    const { error: updateError } = await supabase.from('perfis').update({ credits: p.credits + amount }).eq('id', playerId);
    
    if (updateError) {
        toast.error("Erro ao atualizar créditos.", { description: updateError.message });
        return false;
    } else {
        toast.success("Créditos atualizados com sucesso!");
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['profile', playerId] });
        return true;
    }
  };

  const createPlayerCard = async (options: { name: string; numbers: number[][]; }) => {
    if (!user || !profile || !gameSettings || profile.credits < gameSettings.custo_nova_cartela) return null;
    await supabase.from('perfis').update({ credits: profile.credits - gameSettings.custo_nova_cartela }).eq('id', user.id);
    const { data } = await supabase.from('cartelas_jogador').insert({ player_id: user.id, ...options, uses_left: 1 }).select().single();
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['playerCards', user?.id] });
    return data as PlayerCard;
  };

  const deletePlayerCard = async (cardId: string) => {
    const { error } = await supabase.from('cartelas_jogador').delete().eq('id', cardId);
    if (error) {
      toast.error("Erro ao deletar cartela.", { description: error.message });
    } else {
      toast.success("Cartela deletada com sucesso.");
      queryClient.invalidateQueries({ queryKey: ['playerCards', user?.id] });
    }
  };
  
  const toggleArchivePlayerCard = async (cardId: string, archive: boolean) => { await supabase.from('cartelas_jogador').update({ is_archived: archive }).eq('id', cardId); };

  const joinMatch = async (matchId: string, playerCardIds: string[]) => {
    const { data } = await supabase.functions.invoke('join-match', { body: { matchId, playerCardIds } });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return data as MatchCard[];
  };

  const buyCardUses = async (playerCardId: string) => {
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
      updateGameSettings, createPlayerCard, deletePlayerCard, toggleArchivePlayerCard, joinMatch, buyCardUses,
      requestCredits, resubmitCreditRequest, resolveCreditRequest, unblockCreditRequest, deleteCreditRequest, 
      requestRedeem, resubmitRedeemRequest, resolveRedeemRequest, unblockRedeemRequest, deleteRedeemRequest, 
      updatePlayerCredits,
      getMatchCards, getPlayerMatchCards, fetchRequestMessages, fetchRedeemMessages
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