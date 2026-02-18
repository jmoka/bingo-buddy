import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { PlayerCard, MatchCard } from '@/types/match';
import { useGameSettings } from './useGameSettings';

export const usePlayerCards = () => {
  const { user, profile } = useAuth();
  const { gameSettings } = useGameSettings();
  const queryClient = useQueryClient();

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

  const createPlayerCard = async (options: { name: string; numbers: number[][]; }) => {
    if (!user || !profile || !gameSettings || profile.credits < gameSettings.custo_nova_cartela) {
      toast.error('Créditos insuficientes para criar uma nova cartela.');
      return null;
    }
    await supabase.from('perfis').update({ credits: profile.credits - gameSettings.custo_nova_cartela }).eq('id', user.id);
    const { data } = await supabase.from('cartelas_jogador').insert({ player_id: user.id, ...options, uses_left: 1 }).select().single();
    queryClient.invalidateQueries({ queryKey: ['playerCards', user.id] });
    queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    return data as PlayerCard;
  };

  const deletePlayerCard = async (cardId: string) => {
    const { error } = await supabase.from('cartelas_jogador').delete().eq('id', cardId);
    if (error) {
      toast.error("Erro ao deletar cartela.", { description: error.message });
    } else {
      toast.success("Cartela excluída permanentemente.");
      queryClient.invalidateQueries({ queryKey: ['playerCards', user?.id] });
    }
  };
  
  const toggleArchivePlayerCard = async (cardId: string, archive: boolean) => {
    const { error } = await supabase.from('cartelas_jogador').update({ is_archived: archive }).eq('id', cardId);
    if (error) {
      toast.error("Erro ao alterar status da cartela.");
    } else {
      toast.success(archive ? "Cartela arquivada!" : "Cartela restaurada!");
      queryClient.invalidateQueries({ queryKey: ['playerCards', user?.id] });
    }
  };

  const buyCardUses = async (playerCardId: string) => {
    if (!profile || !gameSettings || profile.credits < gameSettings.custo_recarga_cartela) {
      toast.error('Créditos insuficientes para recarregar.');
      return false;
    }

    const { error: profileError } = await supabase.from('perfis').update({ credits: profile.credits - gameSettings.custo_recarga_cartela }).eq('id', profile.id);
    if (profileError) {
      toast.error("Erro ao debitar créditos.", { description: profileError.message });
      return false;
    }

    const card = playerCards.find(c => c.id === playerCardId);
    if (card) {
      const { error: cardError } = await supabase.from('cartelas_jogador').update({ uses_left: card.uses_left + gameSettings.usos_por_recarga }).eq('id', playerCardId);
      if (cardError) {
        await supabase.from('perfis').update({ credits: profile.credits }).eq('id', profile.id);
        toast.error("Erro ao recarregar cartela.", { description: cardError.message });
        return false;
      }
    } else {
        await supabase.from('perfis').update({ credits: profile.credits }).eq('id', profile.id);
        toast.error("Cartela não encontrada para recarregar.");
        return false;
    }
    
    queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['playerCards', user?.id] });
    return true;
  };

  const joinMatch = async (matchId: string, playerCardIds: string[]): Promise<MatchCard[] | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('join-match', { body: { matchId, playerCardIds } });
      if (error) {
        let errorMessage = "Ocorreu um erro ao entrar na partida.";
        if (error.context && typeof error.context.text === 'function') {
            const errorText = await error.context.text();
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error) errorMessage = errorJson.error;
            } catch (e) {
                errorMessage = errorText.length < 100 ? errorText : errorMessage;
            }
        } else {
            errorMessage = error.message || errorMessage;
        }
        toast.error(errorMessage);
        return null;
      }
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['playerCards', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['matchCards'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      return data as MatchCard[];
    } catch (e) {
      toast.error("Ocorreu um erro inesperado.", { description: (e as Error).message });
      return null;
    }
  };

  return {
    playerCards,
    createPlayerCard,
    deletePlayerCard,
    toggleArchivePlayerCard,
    buyCardUses,
    joinMatch,
  };
};