import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Match, MatchCard, MatchStatus } from '@/types/match';
import { toast } from 'sonner';
import { useGameSettings } from './useGameSettings';

// Helper para mutações otimistas de partidas
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
      if (context?.previousMatches) {
        queryClient.setQueryData(['matches'], context.previousMatches);
      }
      toast.error("Ocorreu um erro.", { description: (err as Error).message });
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
      const { data, error } = await supabase.from('partidas').select('*').order('start_time', { ascending: false });
      if (error) throw error;
      return data as Match[];
    },
  });

  const { data: matchCards = [], isLoading: isLoadingCards } = useQuery({
    queryKey: ['matchCards'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartelas_partida').select('*');
      if (error) throw error;
      return data.map(c => ({ ...c, marked_numbers: new Set(c.marked_numbers || []) })) as MatchCard[];
    },
  });

  const triggerAutoEngine = async () => {
    if (gameSettings?.auto_engine_enabled) {
      try {
        await supabase.functions.invoke('auto-match-engine');
      } catch (e) {
        console.error("Erro ao disparar motor automático:", e);
      }
    }
  };

  const createMatch = async (data: any) => {
    const status = data.is_auto_calling ? 'open' : 'waiting';
    const { error } = await supabase.from('partidas').insert([{ ...data, status }]);
    if (error) toast.error(error.message);
    else toast.success('Partida criada com sucesso!');
    await queryClient.invalidateQueries({ queryKey: ['matches'] });
  };

  const updateMatch = async (matchId: string, data: Partial<Match>) => {
    const matchToUpdate = matches.find(m => m.id === matchId);
    if (!matchToUpdate) return;
    const updatedData = { ...data };
    if (data.is_auto_calling && matchToUpdate.status === 'waiting') {
      updatedData.status = 'open';
    }
    updateMatchMutation.mutate({ matchId, updates: updatedData });
    toast.success('Partida atualizada com sucesso!');
  };

  const openMatch = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const prizeUpdate = { ...match.prize };
    if ('returnedReason' in prizeUpdate) {
      delete (prizeUpdate as any).returnedReason;
    }
    updateMatchMutation.mutate({ matchId, updates: { status: 'open', prize: prizeUpdate } });
  };
  
  const startMatch = async (matchId: string, force = false) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const playersInMatch = new Set(matchCards.filter(mc => mc.match_id === matchId).map(mc => mc.player_id)).size;

    if (playersInMatch < 1) {
      if (match.is_auto_calling) {
        await supabase.from('partidas').delete().eq('id', matchId);
        toast.warning(`Partida automática "${match.name}" excluída.`, { description: 'Nenhum jogador se inscreveu a tempo.' });
      } else {
        toast.error('A partida não pode ser iniciada sem jogadores.', { description: 'Retornando a partida para o status "Aguardando".' });
        const newPrize = { ...match.prize, returnedReason: 'NO_PLAYERS' as const };
        await supabase.from('partidas').update({ status: 'waiting', is_auto_calling: false, prize: newPrize }).eq('id', matchId);
      }
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
      return;
    }

    if (!force && playersInMatch < match.min_players) {
      toast.error('A partida não pode ser iniciada.', { description: `São necessários no mínimo ${match.min_players} jogadores, mas há apenas ${playersInMatch}.` });
      return;
    }
    
    const updatePayload: Partial<Match> = { status: 'in_progress' };
    if (match.is_auto_calling && gameSettings) {
      const intervalInMs = (gameSettings.intervalo_sorteio_auto_seg || 120) * 1000;
      updatePayload.next_auto_call_timestamp = new Date(Date.now() + intervalInMs).toISOString();
    }
    
    updateMatchMutation.mutate({ matchId, updates: updatePayload });
    triggerAutoEngine();
  };

  const finishMatch = (matchId: string) => {
    updateMatchMutation.mutate({ matchId, updates: { status: 'finished' } });
  };
  
  const deleteMatch = async (matchId: string) => {
    const { error } = await supabase.from('partidas').delete().eq('id', matchId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Partida excluída.');
      triggerAutoEngine();
    }
    await queryClient.invalidateQueries({ queryKey: ['matches'] });
  };

  const toggleAutoCall = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !gameSettings) return;
    const isEnabling = !match.is_auto_calling;
    const updates = {
      is_auto_calling: isEnabling,
      next_auto_call_timestamp: isEnabling ? new Date(Date.now() + gameSettings.intervalo_sorteio_auto_seg * 1000).toISOString() : null,
    };
    updateMatchMutation.mutate({ matchId, updates });
  };

  const callNumber = async (matchId: string, num: number) => {
    try {
      const { error } = await supabase.functions.invoke('call-number', { body: { matchId, num } });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
      await queryClient.invalidateQueries({ queryKey: ['matchCards'] });
    } catch (error) {
      toast.error("Erro ao sortear número.", { description: (error as Error).message });
    }
  };

  const getMatchCards = (matchId: string) => matchCards.filter(c => c.match_id === matchId);
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
    deleteMatch,
    toggleAutoCall,
    callNumber,
    getMatchCards,
    getPlayerMatchCards,
  };
};