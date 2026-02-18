import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { RedeemRequest } from '@/types/match';
import { useAdminData } from './useAdminData';

export const useRedeemRequests = () => {
  const { user, profile } = useAuth();
  const { updatePlayerCredits } = useAdminData();
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
    if (!user || !profile || profile.credits < credits) {
        toast.error('Créditos insuficientes!');
        return false;
    }
    await updatePlayerCredits(user.id, -credits);
    const { data: newRequest, error } = await supabase.from('solicitacoes_resgate').insert({
        player_id: user.id,
        credits_requested: credits,
        amount_to_receive: amount,
        status: 'pending'
    }).select().single();
    if (error) {
        await updatePlayerCredits(user.id, credits);
        toast.error(error.message);
        return false;
    }
    await supabase.from('mensagens_resgate').insert({
        redeem_request_id: newRequest.id,
        sender_id: user.id,
        message: message || `Nova solicitação de resgate: ${credits} créditos. Valor a receber: R$ ${amount.toFixed(2)}`
    });
    await supabase.functions.invoke('notify-n8n', { body: { event: 'REDEEM_REQUEST', data: { requestId: newRequest.id, credits, amount, userEmail: user.email } } });
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