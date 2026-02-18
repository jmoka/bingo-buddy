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

  const createPlayerCard = async (options: { name: string; numbers: number[][]; creditType: 'real' | 'fake' }) => {
    if (!user || !profile || !gameSettings) return null;
    
    const cost = gameSettings.custo_nova_cartela;
    const balance = options.creditType === 'real' ? profile.credits : profile.fake_credits;

    if (balance < cost) {
      toast.error(`Saldo de créditos ${options.creditType === 'real' ? 'reais' : 'de brincar'} insuficiente.`);
      return null;
    }

    try {
      // Usando a função RPC para garantir atomicidade (débito + criação)
      const { data, error } = await supabase.rpc('buy_player_card', {
        p_name: options.name,
        p_numbers: options.numbers,
        p_credit_type: options.creditType
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['playerCards', user.id] });
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      return data as PlayerCard;
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar cartela.");
      return null;
    }
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
    if (!profile || !gameSettings) return false;

    // Precisamos saber o tipo da cartela para debitar o saldo correto
    const card = playerCards.find(c => c.id === playerCardId);
    if (!card) return false;

    const cost = gameSettings.custo_recarga_cartela;
    const creditType = (card as any).credit_type || 'real';
    const balance = creditType === 'real' ? profile.credits : profile.fake_credits;

    if (balance < cost) {
      toast.error(`Saldo insuficiente para recarregar esta cartela.`);
      return false;
    }

    const balanceField = creditType === 'real' ? 'credits' : 'fake_credits';

    const { error: profileError } = await supabase
      .from('perfis')
      .update({ [balanceField]: balance - cost })
      .eq('id', profile.id);

    if (profileError) {
      toast.error("Erro ao debitar créditos.", { description: profileError.message });
      return false;
    }

    const { error: cardError } = await supabase
      .from('cartelas_jogador')
      .update({ uses_left: card.uses_left + gameSettings.usos_por_recarga })
      .eq('id', playerCardId);

    if (cardError) {
      // Reverter saldo se der erro na cartela
      await supabase.from('perfis').update({ [balanceField]: balance }).eq('id', profile.id);
      toast.error("Erro ao recarregar cartela.", { description: cardError.message });
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