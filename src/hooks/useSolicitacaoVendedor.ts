import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { SolicitacaoVendedor } from '@/types/rifa';

export const useSolicitacaoVendedor = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: minhasSolicitacoes = [], isLoading } = useQuery({
    queryKey: ['minhasSolicitacoesVendedor', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('solicitacoes_vendedor')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SolicitacaoVendedor[];
    },
    enabled: !!user,
  });

  const solicitacaoPendente = minhasSolicitacoes.find(s => s.status === 'pendente');
  const solicitacaoAprovada = minhasSolicitacoes.find(s => s.status === 'aprovado');
  const solicitacaoRejeitada = minhasSolicitacoes.find(s => s.status === 'rejeitado');

  const solicitarVendedor = async (
    nome: string,
    documento: string,
    telefone: string,
    endereco: string,
    mensagem?: string,
  ): Promise<boolean> => {
    if (!user) return false;
    if (solicitacaoPendente) {
      toast.error('Você já tem uma solicitação pendente.');
      return false;
    }
    const { error } = await supabase.from('solicitacoes_vendedor').insert([{
      user_id: user.id,
      nome,
      documento: documento || null,
      telefone: telefone || null,
      endereco: endereco || null,
      mensagem: mensagem || null,
    }]);
    if (error) {
      toast.error('Erro ao enviar solicitação.');
      return false;
    }
    toast.success('Solicitação enviada! Aguarde a aprovação do administrador.');
    queryClient.invalidateQueries({ queryKey: ['minhasSolicitacoesVendedor', user.id] });
    return true;
  };

  const cancelarSolicitacao = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('solicitacoes_vendedor')
      .delete()
      .eq('id', id)
      .eq('status', 'pendente');
    if (error) {
      toast.error('Erro ao cancelar solicitação.');
      return false;
    }
    toast.success('Solicitação cancelada.');
    queryClient.invalidateQueries({ queryKey: ['minhasSolicitacoesVendedor', user?.id] });
    return true;
  };

  return {
    minhasSolicitacoes,
    solicitacaoPendente,
    solicitacaoAprovada,
    solicitacaoRejeitada,
    isLoading,
    solicitarVendedor,
    cancelarSolicitacao,
  };
};
