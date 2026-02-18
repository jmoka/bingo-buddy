import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Profile } from '@/contexts/AuthContext';
import { PlayerCard, Win, CreditRequest, RedeemRequest } from '@/types/match';

export const useAdminData = () => {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin';

  const { data: players = [], isLoading: isLoadingPlayers } = useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      const { data, error } = await supabase.from('perfis').select('*');
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isAdmin,
    refetchInterval: 3000,
  });

  const { data: allPlayerCards = [] } = useQuery({
    queryKey: ['allPlayerCards'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartelas_jogador').select('*');
      if (error) throw error;
      return data as PlayerCard[];
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const { data: allWins = [] } = useQuery({
    queryKey: ['allWins'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vitorias').select('*');
      if (error) throw error;
      return data as Win[];
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const { data: rawCreditRequests = [], isLoading: isLoadingRequests } = useQuery({
    queryKey: ['rawCreditRequests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('solicitacoes_credito').select('*').order('requested_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
    refetchInterval: 3000,
  });

  const allCreditRequests = useMemo(() => {
    if (!rawCreditRequests || !players) return [];
    const playersMap = new Map(players.map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
    return rawCreditRequests.map(req => ({
      ...req,
      perfis: playersMap.get(req.player_id) || null
    })) as CreditRequest[];
  }, [rawCreditRequests, players]);

  const { data: rawRedeemRequests = [], isLoading: isLoadingRedeems } = useQuery({
    queryKey: ['rawRedeemRequests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('solicitacoes_resgate').select('*').order('requested_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
    refetchInterval: 3000,
  });

  const allRedeemRequests = useMemo(() => {
    if (!rawRedeemRequests || !players) return [];
    const playersMap = new Map(players.map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]));
    return rawRedeemRequests.map(req => ({
      ...req,
      perfis: playersMap.get(req.player_id) || null
    })) as RedeemRequest[];
  }, [rawRedeemRequests, players]);

  const updatePlayerCredits = async (playerId: string, amount: number): Promise<boolean> => {
    const { data: p, error: fetchError } = await supabase.from('perfis').select('credits').eq('id', playerId).single();
    if (fetchError || !p) {
        toast.error("Erro ao buscar perfil.");
        return false;
    }
    const { error: updateError } = await supabase.from('perfis').update({ credits: p.credits + amount }).eq('id', playerId);
    if (updateError) {
        toast.error("Erro ao atualizar créditos.");
        return false;
    } else {
        toast.success("Créditos reais atualizados!");
        await queryClient.refetchQueries({ queryKey: ['players'] });
        await queryClient.refetchQueries({ queryKey: ['profile'] });
        return true;
    }
  };

  const updatePlayerFakeCredits = async (playerId: string, amount: number): Promise<boolean> => {
    const { data: p, error: fetchError } = await supabase.from('perfis').select('fake_credits').eq('id', playerId).single();
    if (fetchError || !p) return false;
    const { error: updateError } = await supabase.from('perfis').update({ fake_credits: (p.fake_credits || 0) + amount }).eq('id', playerId);
    if (updateError) return false;
    await queryClient.refetchQueries({ queryKey: ['players'] });
    await queryClient.refetchQueries({ queryKey: ['profile'] });
    return true;
  };

  const resolveCreditRequest = async (requestId: string, status: 'approved' | 'rejected', creditsGranted?: number, notes?: string): Promise<boolean> => {
    if (!profile || profile.role !== 'admin' || !user) return false;
    const request = allCreditRequests.find(r => r.id === requestId);
    if (!request) return false;
    if (status === 'approved' && creditsGranted !== undefined) {
      await updatePlayerCredits(request.player_id, creditsGranted);
    }
    await supabase.from('solicitacoes_credito').update({
      status, credits_granted: status === 'approved' ? creditsGranted : null,
      resolved_at: new Date().toISOString(), resolved_by: user.id, notes: notes || null,
    }).eq('id', requestId);
    if (notes) {
        await supabase.from('mensagens_solicitacao').insert({
            credit_request_id: requestId,
            sender_id: user.id,
            message: notes
        });
    }
    await queryClient.refetchQueries({ queryKey: ['rawCreditRequests'] });
    return true;
  };

  const unblockCreditRequest = async (requestId: string) => {
    await supabase.from('solicitacoes_credito').update({
      status: 'pending', notes: 'Solicitação reaberta pelo administrador.', resolved_at: null, resolved_by: null, credits_granted: null,
    }).eq('id', requestId);
    toast.success('Solicitação reaberta');
    await queryClient.refetchQueries({ queryKey: ['rawCreditRequests'] });
  };

  const deleteCreditRequest = async (requestId: string) => { 
    await supabase.from('solicitacoes_credito').delete().eq('id', requestId); 
    await queryClient.refetchQueries({ queryKey: ['rawCreditRequests'] });
  };

  const resolveRedeemRequest = async (requestId: string, status: 'approved' | 'rejected', receiptFile?: File, notes?: string): Promise<boolean> => {
    if (!profile || profile.role !== 'admin' || !user) return false;
    const request = allRedeemRequests.find(r => r.id === requestId);
    if (!request) return false;
    let receiptPath = null;
    if (status === 'approved' && receiptFile) {
        const fileName = `redeems/${requestId}/${Date.now()}.${receiptFile.name.split('.').pop()}`;
        await supabase.storage.from('receipts').upload(fileName, receiptFile);
        receiptPath = fileName;
    }
    if (status === 'rejected') {
        await updatePlayerCredits(request.player_id, request.credits_requested);
        toast.info(`${request.credits_requested} créditos foram estornados.`);
    }
    await supabase.from('solicitacoes_resgate').update({
        status, receipt_url: receiptPath, notes: notes || null, resolved_at: new Date().toISOString(), resolved_by: user.id
    }).eq('id', requestId);
    if (notes) {
        await supabase.from('mensagens_resgate').insert({ redeem_request_id: requestId, sender_id: user.id, message: notes });
    }
    await queryClient.refetchQueries({ queryKey: ['rawRedeemRequests'] });
    return true;
  };

  const unblockRedeemRequest = async (requestId: string) => {
    const request = allRedeemRequests.find(r => r.id === requestId);
    if (!request) return;
    await updatePlayerCredits(request.player_id, -request.credits_requested);
    await supabase.from('solicitacoes_resgate').update({
        status: 'pending',
        notes: 'Solicitação reaberta pelo administrador.',
        resolved_at: null,
        resolved_by: null,
    }).eq('id', requestId);
    toast.success('Solicitação de resgate reaberta.');
    await queryClient.refetchQueries({ queryKey: ['rawRedeemRequests'] });
  };

  const deleteRedeemRequest = async (requestId: string) => {
    await supabase.from('solicitacoes_resgate').delete().eq('id', requestId);
    await queryClient.refetchQueries({ queryKey: ['rawRedeemRequests'] });
  };

  const fetchRequestMessages = async (requestId: string) => {
    const { data, error } = await supabase.from('mensagens_solicitacao').select('*').eq('credit_request_id', requestId).order('created_at', { ascending: true });
    if (error) return [];
    return data;
  };

  const fetchRedeemMessages = async (requestId: string) => {
    const { data, error } = await supabase.from('mensagens_resgate').select('*').eq('redeem_request_id', requestId).order('created_at', { ascending: true });
    if (error) return [];
    return data;
  };

  return {
    players,
    allPlayerCards,
    allWins,
    allCreditRequests,
    allRedeemRequests,
    isLoading: isLoadingPlayers || isLoadingRequests || isLoadingRedeems,
    updatePlayerCredits,
    updatePlayerFakeCredits,
    resolveCreditRequest,
    unblockCreditRequest,
    deleteCreditRequest,
    resolveRedeemRequest,
    unblockRedeemRequest,
    deleteRedeemRequest,
    fetchRequestMessages,
    fetchRedeemMessages,
  };
};