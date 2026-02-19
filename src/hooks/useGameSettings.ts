import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GameSettings } from '@/contexts/GameContext';
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

  const resetAdminProfit = async () => {
    const { error } = await supabase.rpc('reset_admin_profit');
    if (error) {
      toast.error("Erro ao zerar o lucro.");
    } else {
      toast.success("Lucro do admin zerado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
    }
  };

  return {
    gameSettings,
    updateGameSettings,
    resetAdminProfit,
  };
};