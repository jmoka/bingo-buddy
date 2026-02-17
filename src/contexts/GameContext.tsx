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
  updatePlayerCredits: (playerId: string, amount: number) => Promise<void>;
  getMatchCards: (matchId: string) => MatchCard[];
  getPlayerMatchCards: (matchId: string, playerId: string) => MatchCard[];
}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

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
    enabled: !!profile && profile.role === 'admin',
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
    enabled: !!profile && profile.role === 'admin',
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
    enabled: !!profile && profile.role === 'admin',
  });

  const { data: creditRequests = [], isLoading: l6 } = useQuery({
    queryKey: ['creditRequests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('solicitacoes_credito').select('*').eq('player_id', user.id).order('requested_at', { ascending: false });
      if (error) throw error;
      return data as CreditRequest[];
    },
    enabled: !!user,
  });

  const { data: allCreditRequests = [], isLoading: l7 } = useQuery({
    queryKey: ['allCreditRequests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('solicitacoes_credito').select('*, perfis(full_name, avatar_url)').order('requested_at', { ascending: false });
      if (error) throw error;
      return data as CreditRequest[];
    },
    enabled: !!profile && profile.role === 'admin',
  });

  const { data: gameSettings, isLoading: l4 } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracoes').select('*').limit(1).single();
      if (error) {
        console.error("Error fetching settings, using defaults", error);
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
    staleTime: 0, // Carregar sempre dados frescos para evitar confusão no admin
  });

  useEffect(() => {
    const channel = supabase.channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
        queryClient.invalidateQueries({ queryKey: ['playerCards'] });
        queryClient.invalidateQueries({ queryKey: ['allPlayerCards'] });
        queryClient.invalidateQueries({ queryKey: ['matchCards'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['wins'] });
        queryClient.invalidateQueries({ queryKey: ['allWins'] });
        queryClient.invalidateQueries({ queryKey: ['creditRequests'] });
        queryClient.invalidateQueries({ queryKey: ['allCreditRequests'] });
        if (payload.table === 'configuracoes') {
          queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const createMatch = async (data: any) => {
    const { error } = await supabase.from('partidas').insert([{ ...data, status: 'waiting' }]);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Partida criada com sucesso!");
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
  const startMatch = (matchId: string) => updateMatchStatus(matchId, 'in_progress');
  const finishMatch = (matchId: string) => updateMatchStatus(matchId, 'finished');

  const deleteMatch = async (matchId: string) => {
    const { error } = await supabase.from('partidas').delete().eq('id', matchId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Partida excluída.");
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    }
  };

  const toggleAutoCall = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !gameSettings) return;
    const isEnabling = !match.is_auto_calling;
    const { error } = await supabase.from('partidas').update({
      is_auto_calling: isEnabling,
      next_auto_call_timestamp: isEnabling ? new Date(Date.now() + gameSettings.intervalo_sorteio_auto_seg * 1000).toISOString() : null,
    }).eq('id', matchId);
    if (error) {
      toast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    }
  };

  const callNumber = async (matchId: string, num: number) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.called_numbers.includes(num)) return;

    const { error } = await supabase.functions.invoke('call-number', {
      body: { matchId, num },
    });

    if (error) {
      toast.error(`Erro ao sortear número: ${error.message}`);
    }
  };

  const requestCredits = async (file: File, creditsRequested: number, amountPaid: number): Promise<boolean> => {
    if (!user || !profile) {
      toast.error("Você precisa estar logado para solicitar créditos.");
      return false;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, file);

    if (uploadError) {
      toast.error(`Erro no upload: ${uploadError.message}`);
      return false;
    }

    const { data: newRequest, error: insertError } = await supabase
      .from('solicitacoes_credito')
      .insert({ 
        player_id: user.id, 
        receipt_url: filePath, 
        status: 'pending',
        credits_requested: creditsRequested,
        amount_paid: amountPaid,
      })
      .select()
      .single();

    if (insertError) {
      toast.error(`Erro ao criar solicitação: ${insertError.message}`);
      return false;
    }

    const { error: notifyError } = await supabase.functions.invoke('notify-n8n', {
      body: {
        event: 'CREDIT_REQUEST',
        data: {
          requestId: newRequest.id,
          receiptPath: filePath,
          userName: profile.full_name || 'Não definido',
          userEmail: user.email,
          userId: user.id,
          creditsRequested,
          amountPaid,
        }
      }
    });

    if (notifyError) {
      let detailedError = notifyError.message;
      if ('context' in notifyError && typeof notifyError.context.json === 'function') {
        try {
          const errorJson = await notifyError.context.json();
          if (errorJson.error) { detailedError = errorJson.error; }
        } catch (e) { console.error("Failed to parse edge function error response:", e); }
      }
      toast.error(`Erro ao notificar o admin: ${detailedError}`);
    }

    return true;
  };

  const resolveCreditRequest = async (requestId: string, status: 'approved' | 'rejected', creditsGranted?: number, notes?: string): Promise<boolean> => {
    if (!profile || profile.role !== 'admin' || !user) {
      toast.error("Apenas administradores podem resolver solicitações.");
      return false;
    }

    const request = allCreditRequests.find(r => r.id === requestId);
    if (!request) {
      toast.error("Solicitação não encontrada.");
      return false;
    }

    if (status === 'approved') {
      if (!creditsGranted || creditsGranted <= 0) {
        toast.error("É necessário informar um valor de crédito positivo para aprovar.");
        return false;
      }
      await updatePlayerCredits(request.player_id, creditsGranted);
    }

    const { error } = await supabase
      .from('solicitacoes_credito')
      .update({
        status,
        credits_granted: status === 'approved' ? creditsGranted : null,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        notes,
      })
      .eq('id', requestId);

    if (error) {
      toast.error(`Erro ao resolver solicitação: ${error.message}`);
      return false;
    }

    toast.success(`Solicitação ${status === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso.`);
    queryClient.invalidateQueries({ queryKey: ['allCreditRequests'] });
    queryClient.invalidateQueries({ queryKey: ['players'] });
    return true;
  };

  const updatePlayerCredits = async (playerId: string, amount: number) => {
    if (isNaN(amount) || amount === 0) return;

    const { data: targetPlayer, error: fetchError } = await supabase
      .from('perfis')
      .select('credits')
      .eq('id', playerId)
      .single();

    if (fetchError || !targetPlayer) {
      toast.error("Não foi possível encontrar o jogador.");
      return;
    }

    const newCredits = targetPlayer.credits + amount;
    if (newCredits < 0) {
      toast.error("O jogador não pode ter créditos negativos.");
      return;
    }

    const { error: updateError } = await supabase
      .from('perfis')
      .update({ credits: newCredits })
      .eq('id', playerId);

    if (updateError) {
      toast.error(`Erro ao atualizar créditos: ${updateError.message}`);
    } else {
      toast.success(`Créditos ${amount > 0 ? 'adicionados' : 'removidos'}. Novo saldo: ${newCredits}.`);
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['profile', playerId] });
    }
  };

  const createPlayerCard = async (options: { name: string; numbers: number[][]; }): Promise<PlayerCard | null> => {
    if (!user || !profile || !gameSettings) {
        toast.error('Não foi possível criar a cartela.');
        return null;
    }
    if (profile.credits < gameSettings.custo_nova_cartela) {
      toast.error('Créditos insuficientes!');
      return null;
    }

    const { data: existingName, error: nameCheckError } = await supabase
        .from('cartelas_jogador')
        .select('id', { count: 'exact' })
        .eq('player_id', user.id)
        .eq('name', options.name);

    if (nameCheckError) {
        toast.error(`Erro ao verificar nomes: ${nameCheckError.message}`);
        return null;
    }

    if (existingName && existingName.length > 0) {
        toast.error('Você já possui uma cartela com este nome. Por favor, escolha outro.');
        return null;
    }

    const { data: existingCards, error: checkError } = await supabase
      .from('cartelas_jogador')
      .select('id', { count: 'exact' })
      .eq('player_id', user.id)
      .eq('numbers', JSON.stringify(options.numbers));

    if (checkError) {
      toast.error(`Erro ao verificar cartelas: ${checkError.message}`);
      return null;
    }

    if (existingCards && existingCards.length > 0) {
      toast.error('Você já possui uma cartela com exatamente os mesmos números.');
      return null;
    }
    
    const { error: creditError } = await supabase.from('perfis').update({ credits: profile.credits - gameSettings.custo_nova_cartela }).eq('id', user.id);
    if (creditError) { toast.error(creditError.message); return null; }

    const newCard = { player_id: user.id, ...options, uses_left: 1 };
    const { data, error } = await supabase.from('cartelas_jogador').insert(newCard).select().single();
    if (error) { 
        await supabase.from('perfis').update({ credits: profile.credits }).eq('id', user.id);
        toast.error(error.message); 
        return null; 
    }
    
    queryClient.invalidateQueries({ queryKey: ['playerCards'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return data as PlayerCard;
  };

  const deletePlayerCard = async (cardId: string) => {
    const hasWins = wins.some(w => w.player_card_id === cardId);
    if (hasWins) {
      toast.error("Cartelas premiadas não podem ser excluídas. Você pode arquivá-las.");
      return;
    }

    const activeMatchCards = matchCards.filter(mc => 
      mc.player_card_id === cardId && 
      matches.some(m => m.id === mc.match_id && (m.status === 'in_progress' || m.status === 'open'))
    );

    if (activeMatchCards.length > 0) {
      toast.error("Não é possível excluir uma cartela que está em uma partida ativa ou com inscrições abertas.");
      return;
    }

    const { error } = await supabase.from('cartelas_jogador').delete().eq('id', cardId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Cartela excluída com sucesso.");
      queryClient.invalidateQueries({ queryKey: ['playerCards'] });
    }
  };

  const toggleArchivePlayerCard = async (cardId: string, archive: boolean) => {
    if (archive) {
      const activeMatchCards = matchCards.filter(mc => 
        mc.player_card_id === cardId && 
        matches.some(m => m.id === mc.match_id && (m.status === 'in_progress' || m.status === 'open'))
      );

      if (activeMatchCards.length > 0) {
        toast.error("Não é possível arquivar uma cartela que está em uma partida ativa ou com inscrições abertas.");
        return;
      }
    }

    const { error } = await supabase
      .from('cartelas_jogador')
      .update({ is_archived: archive })
      .eq('id', cardId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(archive ? "Cartela arquivada." : "Cartela restaurada.");
      queryClient.invalidateQueries({ queryKey: ['playerCards'] });
    }
  };

  const joinMatch = async (matchId: string, playerCardIds: string[]): Promise<MatchCard[] | null> => {
    if (!user || !profile) return null;

    const { data, error } = await supabase.functions.invoke('join-match', {
      body: { matchId, playerCardIds },
    });

    if (error) {
      try {
        const errorData = await error.context.json();
        toast.error(errorData.error || 'Ocorreu um erro ao entrar na partida.');
      } catch (e) {
        toast.error('Ocorreu um erro desconhecido ao entrar na partida.');
      }
      return null;
    }

    queryClient.invalidateQueries({ queryKey: ['matchCards'] });
    queryClient.invalidateQueries({ queryKey: ['playerCards'] });
    queryClient.invalidateQueries({ queryKey: ['matches'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });

    return data as MatchCard[];
  };

  const buyCardUses = async (playerCardId: string): Promise<boolean> => {
    if (!profile || !gameSettings || profile.credits < gameSettings.custo_recarga_cartela) {
      toast.error('Créditos insuficientes!');
      return false;
    }
    const { error: creditError } = await supabase.from('perfis').update({ credits: profile.credits - gameSettings.custo_recarga_cartela }).eq('id', profile.id);
    if (creditError) { toast.error(creditError.message); return false; }

    const card = playerCards.find(c => c.id === playerCardId);
    if (card) {
      const { error } = await supabase.from('cartelas_jogador').update({ uses_left: card.uses_left + gameSettings.usos_por_recarga }).eq('id', playerCardId);
      if (error) { toast.error(error.message); return false; }
    }

    queryClient.invalidateQueries({ queryKey: ['playerCards'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return true;
  };

  const updateGameSettings = async (newSettings: Partial<GameSettings>) => {
    const { error } = await supabase.from('configuracoes').update(newSettings).eq('singleton', true);
    if (error) {
        toast.error(error.message);
    } else {
        toast.success("Configurações salvas com sucesso!");
        queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
    }
  };

  const getMatchCards = (matchId: string) => matchCards.filter(c => c.match_id === matchId);
  const getPlayerMatchCards = (matchId: string, playerId: string) => matchCards.filter(c => c.match_id === matchId && c.player_id === playerId);

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6 || l7;

  return (
    <GameContext.Provider value={{
      matches, players, playerCards, allPlayerCards, matchCards, wins, allWins, creditRequests, allCreditRequests, gameSettings, isLoading,
      createMatch, openMatch, startMatch, callNumber, finishMatch, deleteMatch, toggleAutoCall,
      updateGameSettings, createPlayerCard, deletePlayerCard, toggleArchivePlayerCard, joinMatch, buyCardUses,
      requestCredits, resolveCreditRequest, updatePlayerCredits, getMatchCards, getPlayerMatchCards,
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