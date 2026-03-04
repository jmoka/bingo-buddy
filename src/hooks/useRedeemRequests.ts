import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { RedeemRequest } from '@/types/match';

export const useRedeemRequests = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: redeemRequests = [] } = useQuery({
    queryKey: ['redeemRequests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('solicitacoes_resgate').select('*').eq('player_id', user.id).order('requested_at', { ascending: false });
      if (error) throw error;
      return data as RedeemRequest[];
    },
    enabled: !!user,
  });

  const requestRedeem = async (credits: number, amount: number, message?: string): Promise<boolean> => {
    if (!user || !profile) return false;

    const { data, error } = await supabase.functions.invoke('request-redeem', {
      body: { credits, amount, message },
    });

    if (error || !data?.success) {
      const msg = data?.error;
      if (msg === 'insufficient_credits') toast.error('Créditos insuficientes!');
      else toast.error('Erro ao criar solicitação de resgate.');
      return false;
    }

    queryClient.invalidateQueries({ queryKey: ['redeemRequests', user.id] });
    return true;
  };

  const resubmitRedeemRequest = async (requestId: string, message: string): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from('solicitacoes_resgate').update({
        status: 'pending', resubmission_notes: message, resolved_at: null, resolved_by: null, notes: null
    }).eq('id', requestId);
    if (error) {
        toast.error('Falha ao reenviar solicitação.', { description: error.message });
        return false;
    }
    await supabase.from('mensagens_resgate').insert({ redeem_request_id: requestId, sender_id: user.id, message });
    await supabase.functions.invoke('notify-n8n', { body: { event: 'REDEEM_RESUBMISSION', data: { requestId, userEmail: user.email, message } } });
    queryClient.invalidateQueries({ queryKey: ['redeemRequests', user.id] });
    return true;
  };

  return {
    redeemRequests,
    requestRedeem,
    resubmitRedeemRequest,
  };
};