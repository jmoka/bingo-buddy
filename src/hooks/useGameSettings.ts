import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GameSettings } from '@/types/match';
import { toast } from 'sonner';

export const useGameSettings = () => {
  const queryClient = useQueryClient();

  const { data: gameSettings } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracoes').select('*').eq('singleton', true).single();
      
      if (error) {
        if (error.code === 'PGRST116') { // "The result contains 0 rows"
          console.warn("Nenhuma configuração encontrada. Criando uma configuração padrão...");
          
          // A linha de configuração não existe, vamos criar uma com valores padrão.
          const { data: newSettings, error: insertError } = await supabase
            .from('configuracoes')
            .insert({ singleton: true }) // A maioria das colunas tem valores padrão no DB
            .select()
            .single();

          if (insertError) {
            console.error("FATAL: Falha ao criar configuração padrão:", insertError);
            toast.error("Erro crítico ao configurar o sistema.", {
              description: "Não foi possível criar a linha de configurações padrão.",
              duration: 10000,
            });
            return null;
          }
          
          toast.success("Configuração inicial do sistema criada com sucesso!");
          return newSettings as GameSettings;

        } else {
          console.error("Erro ao buscar configurações do jogo:", error);
          return null;
        }
      }
      return data as GameSettings;
    }
  });

  const updateGameSettings = async (newSettings: Partial<GameSettings>): Promise<boolean> => {
    const { error } = await supabase.from('configuracoes').update(newSettings).eq('singleton', true);
    
    if (error) {
      console.error("Erro ao salvar configurações:", error);
      toast.error("Erro ao salvar no banco de dados: " + error.message);
      return false;
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