import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { VendedorRifa, NumeroRifa, CompraRifa } from '@/types/rifa';

export const useVendedor = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const isVendedor = profile?.role === 'vendedor';

  const { data: meuVendedor, isLoading: isLoadingVendedor } = useQuery({
    queryKey: ['meuVendedor', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('vendedores_rifa')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .single();
      if (error) return null;
      return data as VendedorRifa;
    },
    enabled: !!user && isVendedor,
  });

  const { data: minhasReservas = [], isLoading: isLoadingReservas } = useQuery({
    queryKey: ['minhasReservasVendedor', meuVendedor?.id],
    queryFn: async () => {
      if (!meuVendedor) return [];
      const { data, error } = await supabase
        .from('numeros_rifa')
        .select('*, rifas(id, nome, custo_por_numero, status), cartelas_rifa(codigo_validacao)')
        .eq('vendedor_id', meuVendedor.id)
        .in('status', ['reservado', 'vendido'])
        .order('rifa_id');
      if (error) throw error;
      return data as (NumeroRifa & { rifas: any; cartelas_rifa: { codigo_validacao: string }[] })[];
    },
    enabled: !!meuVendedor,
    refetchInterval: 5000,
  });

  const { data: minhasVendas = [], isLoading: isLoadingVendas } = useQuery({
    queryKey: ['minhasVendasVendedor', meuVendedor?.id],
    queryFn: async () => {
      if (!meuVendedor) return [];
      const { data, error } = await supabase
        .from('compras_rifa')
        .select('*, rifas(nome)')
        .eq('vendedor_id', meuVendedor.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (CompraRifa & { rifas: any })[];
    },
    enabled: !!meuVendedor,
    refetchInterval: 5000,
  });

  const reservarNumeros = async (rifaId: string, numeros: number[]): Promise<boolean> => {
    const { data, error } = await supabase.rpc('reservar_numeros_vendedor', {
      p_rifa_id: rifaId,
      p_numeros: numeros,
    });
    if (error || !data?.success) {
      const msg = data?.error;
      if (msg === 'not_a_vendor') toast.error('Você não está cadastrado como vendedor ativo.');
      else if (msg === 'rifa_not_found') toast.error('Rifa não encontrada ou encerrada.');
      else if (msg === 'insufficient_credits') toast.error('Créditos insuficientes.');
      else if (msg?.startsWith('numero_indisponivel')) {
        const num = msg.split(':')[1];
        toast.error(`Número ${num} não está disponível.`);
      } else toast.error('Erro ao reservar números.');
      return false;
    }
    const preco = data.preco_unitario;
    toast.success(`${numeros.length} número(s) reservado(s)! Preço: R$ ${Number(preco).toFixed(2)} cada.`);
    queryClient.invalidateQueries({ queryKey: ['minhasReservasVendedor', meuVendedor?.id] });
    queryClient.invalidateQueries({ queryKey: ['minhasVendasVendedor', meuVendedor?.id] });
    queryClient.invalidateQueries({ queryKey: ['numerosRifa'] });
    queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    return true;
  };

  const validarVenda = async (
    numeroRifaId: string,
    nome: string,
    telefone: string,
    endereco: string,
  ): Promise<boolean> => {
    const { data, error } = await supabase.rpc('validar_venda_vendedor', {
      p_numero_rifa_id: numeroRifaId,
      p_nome_comprador: nome,
      p_telefone_comprador: telefone || null,
      p_endereco_comprador: endereco || null,
    });
    if (error || !data?.success) {
      const msg = data?.error;
      if (msg === 'not_a_vendor') toast.error('Acesso negado.');
      else if (msg === 'numero_not_found') toast.error('Número não encontrado ou já validado.');
      else toast.error('Erro ao validar venda.');
      return false;
    }
    const comissao = Number(data.comissao_creditada || 0);
    if (comissao > 0) {
      toast.success(`Venda validada! +${comissao.toFixed(2)} créditos de comissão creditados.`);
    } else {
      toast.success('Venda validada com sucesso!');
    }
    queryClient.invalidateQueries({ queryKey: ['minhasReservasVendedor', meuVendedor?.id] });
    queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    return true;
  };

  const cancelarReserva = async (numeroRifaId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('cancelar_reserva_vendedor', {
      p_numero_rifa_id: numeroRifaId,
    });
    if (error || !data?.success) {
      const msg = data?.error;
      if (msg === 'not_a_vendor') toast.error('Acesso negado.');
      else if (msg === 'numero_not_found') toast.error('Número não encontrado ou já não está reservado.');
      else toast.error('Erro ao cancelar reserva.');
      return false;
    }
    const estorno = Number(data.creditos_estornados || 0);
    toast.success(`Reserva cancelada!${estorno > 0 ? ` +${estorno.toFixed(2)} créditos estornados.` : ''}`);
    queryClient.invalidateQueries({ queryKey: ['minhasReservasVendedor', meuVendedor?.id] });
    queryClient.invalidateQueries({ queryKey: ['minhasVendasVendedor', meuVendedor?.id] });
    queryClient.invalidateQueries({ queryKey: ['numerosRifa'] });
    queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    return true;
  };

  const gerarLink = (rifaId?: string): string => {
    const base = window.location.origin;
    const path = rifaId ? `/rifas/${rifaId}` : '/rifas';
    const ref = meuVendedor?.codigo_ref ?? '';
    return `${base}${path}?ref=${ref}`;
  };

  return {
    meuVendedor,
    minhasReservas,
    minhasVendas,
    isLoading: isLoadingVendedor || isLoadingReservas || isLoadingVendas,
    reservarNumeros,
    cancelarReserva,
    validarVenda,
    gerarLink,
  };
};
