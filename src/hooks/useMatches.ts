import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Match, MatchCard, MatchStatus } from '@/types/match';
import { toast } from 'sonner';
import { useGameSettings } from './useGameSettings';

const useUpdateMatchMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, updates }: { matchId: string; updates: Partial<Match> }) => {
      const { error } = await supabase.from('partidas').update(updates).eq('id', matchId);
      if (error) throw error;
    },
    onMutate: async ({ matchId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['matches'] });
      const previousMatches = queryClient.getQueryData<Match[]>(['matches']);
      queryClient.setQueryData<Match[]>(['matches'], (old) =>
        old?.map((match) => (match.id === matchId ? { ...match, ...updates } : match))
      );
      return { previousMatches };
    },
    onError: (err, variables, context) => {
      if (context?.previousMatches) queryClient.setQueryData(['matches'], context.previousMatches);
      toast.error(`Erro ao atualizar partida: ${err.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
};

export const useMatches = () => {
  const queryClient = useQueryClient();
  const { gameSettings } = useGameSettings();
  const updateMatchMutation = useUpdateMatchMutation();

  const { data: matches = [], isLoading: isLoadingMatches } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase.from('partidas').select('*').order('start_time', { ascending: false });
      if (error) throw error;
      return (data as Match[]).filter(m => m.status !== 'finished' || new Date(m.created_at) >= today);
    },
    refetchOnWindowFocus: false,
  });

  const { data: matchCards = [], isLoading: isLoadingCards } = useQuery({
    queryKey: ['matchCards'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartelas_partida').select('*');
      if (error) throw error;
      return data.map(c => ({ ...c, marked_numbers: new Set(c.marked_numbers || []) })) as MatchCard[];
    },
    refetchOnWindowFocus: false,
  });

  const createMatch = async (data: any) => {
    const status = data.is_auto_calling ? 'open' : 'waiting';
    const { error } = await supabase.from('partidas').insert([{ ...data, status }]);
    if (error) toast.error(error.message);
    else toast.success('Partida criada!');
    queryClient.invalidateQueries({ queryKey: ['matches'] });
  };

  const updateMatch = async (matchId: string, data: Partial<Match>) => {
    updateMatchMutation.mutate({ matchId, updates: data });
  };

  const openMatch = async (matchId: string) => {
    updateMatchMutation.mutate({ matchId, updates: { status: 'open' } });
  };
  
  const startMatch = async (matchId: string, force = false) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    if (!force) {
      // Conta cartelas apenas se não estiver forçando o início
      const { count } = await supabase.from('cartelas_partida').select('*', { count: 'exact', head: true }).eq('match_id', matchId);
      const playersInMatch = count || 0;

      if (playersInMatch < match.min_players) {
        toast.error(`Mínimo de ${match.min_players} jogadores necessário.`);
        return;
      }
    }
    
    const updates: any = { status: 'in_progress' };
    if (match.is_auto_calling && gameSettings) {
      updates.next_auto_call_timestamp = new Date(Date.now() + (gameSettings.intervalo_sorteio_auto_seg * 1000)).toISOString();
    }
    
    updateMatchMutation.mutate({ matchId, updates });
    toast.success("Partida iniciada com sucesso! Movida para 'Ao Vivo'.");
  };

  const finishMatch = (matchId: string) => {
    updateMatchMutation.mutate({ matchId, updates: { status: 'finished', is_auto_calling: false } });
  };
  
  const nextFestivalRound = async (matchId: string) => {
    const { data, error } = await supabase.rpc('next_festival_round', { p_match_id: matchId });
    if (error || !data?.success) {
      toast.error("Erro ao avançar rodada.", { description: error?.message || data?.error });
      return false;
    }
    toast.success("Nova rodada iniciada! Globo zerado.");
    queryClient.invalidateQueries({ queryKey: ['matches'] });
    queryClient.invalidateQueries({ queryKey: ['matchCards'] });
    return true;
  };

  const deleteMatch = async (matchId: string) => {
    const { error } = await supabase.from('partidas').delete().eq('id', matchId);
    if (error) toast.error("Erro ao deletar.");
    else queryClient.invalidateQueries({ queryKey: ['matches'] });
  };

  const toggleAutoCall = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !gameSettings) return;
    const isEnabling = !match.is_auto_calling;
    updateMatchMutation.mutate({ 
      matchId, 
      updates: { 
        is_auto_calling: isEnabling,
        next_auto_call_timestamp: isEnabling ? new Date(Date.now() + gameSettings.intervalo_sorteio_auto_seg * 1000).toISOString() : null 
      } 
    });
  };

  const setManualMode = async (cardId: string) => {
    const { data, error } = await supabase.rpc('set_manual_mode', { p_card_id: cardId });
    if (error || !data?.success) {
      toast.error("Não foi possível trocar para o modo manual.");
      return false;
    }
    queryClient.invalidateQueries({ queryKey: ['matchCards'] });
    return true;
  };

  const toggleManualMark = async (cardId: string, num: number) => {
    const { data, error } = await supabase.rpc('toggle_manual_mark', { p_card_id: cardId, p_num: num });
    if (error || !data?.success) {
      toast.error("Erro ao marcar número.");
      return false;
    }
    queryClient.invalidateQueries({ queryKey: ['matchCards'] });
    return true;
  };

  const callNumber = async (matchId: string, specificNumber?: number) => {
    const { data, error } = await supabase.functions.invoke('call-number', { 
      body: { matchId, specificNumber } 
    });
  
    if (error) {
      toast.error("Erro no sorteio.", { description: error.message });
      return;
    }
  
    queryClient.invalidateQueries({ queryKey: ['matches'] });
    queryClient.invalidateQueries({ queryKey: ['matchCards'] });
  
    if (data?.newWinners && data.newWinners.length > 0) {
      const realWinners = data.newWinners.filter((w: any) => w.creditType === 'real');
      if (realWinners.length > 0) {
        const winnerNames = realWinners.map((w: any) => w.playerName).join(', ');
        toast.success('BINGO! Partida/Rodada finalizada!', {
          description: `Vencedor(es): ${winnerNames}.`,
          duration: 10000,
        });
      } else {
        const fakeWinnerNames = data.newWinners.map((w: any) => w.playerName).join(', ');
        toast.info('Bingo de Brincar!', {
          description: `${fakeWinnerNames} venceu. O jogo continua para o prêmio real!`,
          duration: 6000,
        });
      }
    }
  };

  const checkWinState = async (matchId: string) => {
    const { data, error } = await supabase.functions.invoke('call-number', {
      body: { matchId, checkOnly: true }
    });
    if (error) {
      console.error("Erro ao verificar vitória manual:", error);
      return;
    }
    if (data?.newWinners && data.newWinners.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['matchCards'] });
    }
  };

  const getPlayerMatchCards = (matchId: string, playerId: string) => matchCards.filter(c => c.match_id === matchId && c.player_id === playerId);

  return {
    matches,
    matchCards,
    isLoading: isLoadingMatches || isLoadingCards,
    createMatch,
    updateMatch,
    openMatch,
    startMatch,
    finishMatch,
    nextFestivalRound,
    deleteMatch,
    toggleAutoCall,
    callNumber,
    getPlayerMatchCards,
    setManualMode,
    toggleManualMark,
    checkWinState,
  };
};