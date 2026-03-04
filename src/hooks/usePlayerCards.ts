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
    refetchInterval: 5000, // Atualiza a cada 5 segundos
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
    const { data, error } = await supabase.rpc('buy_card_uses', {
      p_player_card_id: playerCardId,
    });

    if (error || !data?.success) {
      const msg = data?.error;
      if (msg === 'insufficient_credits') toast.error('Saldo de créditos reais insuficiente.');
      else if (msg === 'insufficient_fake_credits') toast.error('Saldo de brincar insuficiente.');
      else if (msg === 'unauthorized') toast.error('Ação não autorizada.');
      else toast.error('Erro ao recarregar cartela.');
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