import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GameSettings } from '@/types/match';
import { toast } from 'sonner';

export const useGameSettings = () => {
  const queryClient = useQueryClient();

  const { data: gameSettings } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracoes').select('*').limit(1).maybeSingle();
      if (error || !data) return { 
        custo_nova_cartela: 10, 
        custo_recarga_cartela: 5, 
        usos_por_recarga: 1, 
        intervalo_sorteio_auto_seg: 120, 
        valor_por_credito: 1, 
        admin_profit: 0,
        cartelas_por_folha_bingo: 4,
        auto_engine_enabled: false,
        stripe_enabled: false,
        stripe_pass_fees_to_customer: false,
        stripe_fee_percentage: 3.99,
        stripe_fee_fixed: 0.39
      } as GameSettings;
      return data as GameSettings;
    }
  });

  const updateGameSettings = async (newSettings: Partial<GameSettings>): Promise<boolean> => {
    // Como as colunas de taxas do stripe foram recém criadas, vamos atualiza-las na mão caso elas existam no objeto
    // O RPC 'update_game_settings' antigo não as conhece, então fazemos direto na tabela.
    
    // Atualiza as colunas conhecidas pelo RPC primeiro (se houver alguma)
    const { data, error } = await supabase.rpc('update_game_settings', {
      p_settings: newSettings,
    });

    if (error || !data?.success) {
      if (data?.error === 'unauthorized') toast.error('Ação não autorizada.');
      else {
        console.error("Erro ao salvar configurações:", error);
        toast.error("Erro ao salvar no banco de dados.");
      }
      return false;
    }

    // Em seguida, atualiza as colunas novas do Stripe direto na tabela
    const stripeUpdates: any = {};
    if ('stripe_pass_fees_to_customer' in newSettings) stripeUpdates.stripe_pass_fees_to_customer = newSettings.stripe_pass_fees_to_customer;
    if ('stripe_fee_percentage' in newSettings) stripeUpdates.stripe_fee_percentage = newSettings.stripe_fee_percentage;
    if ('stripe_fee_fixed' in newSettings) stripeUpdates.stripe_fee_fixed = newSettings.stripe_fee_fixed;

    if (Object.keys(stripeUpdates).length > 0) {
        const { error: directError } = await supabase.from('configuracoes').update(stripeUpdates).eq('singleton', true);
        if (directError) {
            console.error("Erro ao salvar taxas do Stripe:", directError);
            toast.error("Erro ao salvar as configurações de taxas.");
            return false;
        }
    }

    await queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
    return true;
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