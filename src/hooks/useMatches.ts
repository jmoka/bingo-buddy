import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Match, MatchCard, MatchStatus } from '@/types/match';
import { toast } from 'sonner';
import { useGameSettings } from './useGameSettings';

export const useMatches = () => {
  const queryClient = useQueryClient();
  const { gameSettings } = useGameSettings();

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('partidas').select('*').order('start_time', { ascending: false });
      if (error) throw error;
      return data as Match[];
    },
  });

  const { data: matchCards = [] } = useQuery({
    queryKey: ['matchCards'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartelas_partida').select('*');
      if (error) throw error;
      return data.map(c => ({ ...c, marked_numbers: new Set(c.marked_numbers || []) })) as MatchCard[];
    },
  });

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
    const { error } = await supabase.from('partidas').update(updatedData).eq('id', matchId);
    if (error) toast.error(error.message);
    else toast.success('Partida atualizada com sucesso!');
    await queryClient.invalidateQueries({ queryKey: ['matches'] });
  };

  const updateMatchStatus = async (matchId: string, status: MatchStatus) => {
    const { error } = await supabase.from('partidas').update({ status }).eq('id', matchId);
    if (error) toast.error(`Erro ao atualizar status: ${error.message}`);
    await queryClient.invalidateQueries({ queryKey: ['matches'] });
  };

  const openMatch = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const prizeUpdate = { ...match.prize };
    if ('returnedReason' in prizeUpdate) {
      delete (prizeUpdate as any).returnedReason;
    }

    const { error } = await supabase.from('partidas').update({ status: 'open', prize: prizeUpdate }).eq('id', matchId);
    if (error) toast.error(`Erro ao abrir partida: ${error.message}`);
    await queryClient.invalidateQueries({ queryKey: ['matches'] });
  };
  
  const startMatch = async (matchId: string, force = false) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const playersInMatch = new Set(matchCards.filter(mc => mc.match_id === matchId).map(mc => mc.player_id)).size;

    if (playersInMatch < 1) {
      if (match.is_auto_calling) {
        // Se for automática e não tiver ninguém, deleta imediatamente
        await supabase.from('partidas').delete().eq('id', matchId);
        toast.warning(`Partida automática "${match.name}" excluída.`, {
          description: 'Nenhum jogador se inscreveu a tempo.'
        });
      } else {
        // Se for manual, mantém o comportamento de retornar para aguardando
        toast.error('A partida não pode ser iniciada sem jogadores.', {
          description: 'Retornando a partida para o status "Aguardando".'
        });
        
        const newPrize = { ...match.prize, returnedReason: 'NO_PLAYERS' as const };
        
        await supabase.from('partidas').update({ 
          status: 'waiting', 
          is_auto_calling: false,
          prize: newPrize
        }).eq('id', matchId);
      }
      
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
      return;
    }

    if (!force && playersInMatch < match.min_players) {
      toast.error('A partida não pode ser iniciada.', {
        description: `São necessários no mínimo ${match.min_players} jogadores, mas há apenas ${playersInMatch}.`
      });
      return;
    }
    
    const updatePayload: Partial<Match> = {
      status: 'in_progress',
    };

    if (match.is_auto_calling && gameSettings) {
      const intervalInMs = (gameSettings.intervalo_sorteio_auto_seg || 120) * 1000;
      updatePayload.next_auto_call_timestamp = new Date(Date.now() + intervalInMs).toISOString();
    }

    const { error } = await supabase.from('partidas').update(updatePayload).eq('id', matchId);
    if (error) {
      toast.error(`Erro ao iniciar partida: ${error.message}`);
    }
    await queryClient.invalidateQueries({ queryKey: ['matches'] });
  };

  const finishMatch = (matchId: string) => updateMatchStatus(matchId, 'finished');
  
  const deleteMatch = async (matchId: string) => {
    const { error } = await supabase.from('partidas').delete().eq('id', matchId);
    if (error) toast.error(error.message);
    else toast.success('Partida excluída.');
    await queryClient.invalidateQueries({ queryKey: ['matches'] });
  };

  const toggleAutoCall = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !gameSettings) return;
    const isEnabling = !match.is_auto_calling;
    const { error } = await supabase.from('partidas').update({
      is_auto_calling: isEnabling,
      next_auto_call_timestamp: isEnabling ? new Date(Date.now() + gameSettings.intervalo_sorteio_auto_seg * 1000).toISOString() : null,
    }).eq('id', matchId);
    if (error) toast.error('Erro ao alterar sorteio automático.');
    await queryClient.invalidateQueries({ queryKey: ['matches'] });
  };

  const callNumber = async (matchId: string, num: number) => {
    try {
      const { error } = await supabase.functions.invoke('call-number', { body: { matchId, num } });
      if (error) throw error;
      // Invalidate queries to refetch data
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