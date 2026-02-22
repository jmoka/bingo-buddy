import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GameSettings } from '@/types/match';
import { toast } from 'sonner';

export const useGameSettings = () => {
  const queryClient = useQueryClient();

  const { data: gameSettings } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracoes').select('*').limit(1).single();
      if (error) return { custo_nova_cartela: 10, custo_recarga_cartela: 5, usos_por_recarga: 1, intervalo_sorteio_auto_seg: 120, valor_por_credito: 1, admin_profit: 0 } as GameSettings;
      return data as GameSettings;
    }
  });

  const updateGameSettings = async (newSettings: Partial<GameSettings>) => {
    await supabase.from('configuracoes').update(newSettings).eq('singleton', true);
    queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
  };

  const withdrawAdminProfit = async (amount: number): Promise<boolean> => {
    if (!gameSettings) return false;
    if (amount <= 0) {
      toast.error("O valor da retirada deve ser positivo.");
      return false;
    }
    if (amount > gameSettings.admin_profit) {
      toast.error("Você não pode retirar mais do que o lucro acumulado.");
      return false;
    }

    const { error } = await supabase.rpc('withdraw_admin_profit', { amount_to_withdraw: amount });
    
    if (error) {
      toast.error("Erro ao retirar o lucro.", { description: error.message });
      return false;
    } else {
      toast.success(`${amount} créditos retirados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
      return true;
    }
  };

  return {
    gameSettings,
    updateGameSettings,
    withdrawAdminProfit,
  };
};