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
    
    const isFake = options.creditType === 'fake';
    const cost = isFake ? 0 : gameSettings.custo_nova_cartela;
    const balance = isFake ? Infinity : profile.credits;

    if (!isFake && balance < cost) {
      toast.error(`Saldo de créditos reais insuficiente.`);
      return null;
    }

    try {
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

    const card = playerCards.find(c => c.id === playerCardId);
    if (!card) return false;

    const isFake = (card as any).credit_type === 'fake';
    const cost = gameSettings.custo_recarga_cartela; // Use the same cost for both

    if (isFake) {
      // Handle fake credits
      if ((profile.fake_credits || 0) < cost) {
        toast.error(`Saldo de brincar insuficiente para recarregar.`);
        return false;
      }
      
      const { error: profileError } = await supabase
        .from('perfis')
        .update({ fake_credits: (profile.fake_credits || 0) - cost })
        .eq('id', profile.id);

      if (profileError) {
        toast.error("Erro ao debitar créditos de brincar.");
        return false;
      }
    } else {
      // Handle real credits
      if (profile.credits < cost) {
        toast.error(`Saldo de créditos reais insuficiente para recarregar.`);
        return false;
      }

      if (cost > 0) {
        const { error: profileError } = await supabase
          .from('perfis')
          .update({ credits: profile.credits - cost })
          .eq('id', profile.id);

        if (profileError) {
          toast.error("Erro ao debitar créditos reais.");
          return false;
        }
      }
    }

    // Update uses_left for the card
    const { error: cardError } = await supabase
      .from('cartelas_jogador')
      .update({ uses_left: card.uses_left + gameSettings.usos_por_recarga })
      .eq('id', playerCardId);

    // If card update fails, revert the credit change
    if (cardError) {
      if (isFake) {
        await supabase.from('perfis').update({ fake_credits: profile.fake_credits }).eq('id', profile.id);
      } else {
        await supabase.from('perfis').update({ credits: profile.credits }).eq('id', profile.id);
      }
      toast.error("Erro ao recarregar cartela.");
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
        toast.error("Erro ao entrar na partida.");
        return null;
      }
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['playerCards', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['matchCards'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      return data as MatchCard[];
    } catch (e) {
      toast.error("Erro inesperado.");
      return null;
    }
  };

  const leaveMatch = async (matchId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke('leave-match', { body: { matchId } });
      if (error) {
        toast.error("Erro ao sair da partida.", { description: error.message });
        return false;
      }
      toast.success("Você saiu da partida.", { description: "Seus créditos foram estornados." });
      
      // Força a atualização dos dados na tela
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['playerCards'] }),
        queryClient.invalidateQueries({ queryKey: ['matchCards'] }),
        queryClient.invalidateQueries({ queryKey: ['matches'] })
      ]);

      return true;
    } catch (e: any) {
      toast.error("Erro inesperado ao sair da partida.", { description: e.message });
      return false;
    }
  };

  return {
    playerCards,
    createPlayerCard,
    deletePlayerCard,
    toggleArchivePlayerCard,
    buyCardUses,
    joinMatch,
    leaveMatch,
  };
};