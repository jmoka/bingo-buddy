import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Rifa, NumeroRifa, CompraRifa, VendedorRifa, ClienteRifa, CartelaRifa } from '@/types/rifa';

export const useRifaAdmin = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === 'admin';

  const { data: todasRifas = [], isLoading: isLoadingRifas } = useQuery({
    queryKey: ['rifasAdmin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rifas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Rifa[];
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const { data: vendedores = [], isLoading: isLoadingVendedores } = useQuery({
    queryKey: ['vendedoresRifa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores_rifa')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as VendedorRifa[];
    },
    enabled: isAdmin,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientesRifa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes_rifa')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as ClienteRifa[];
    },
    enabled: isAdmin,
  });

  const { data: todasCompras = [], isLoading: isLoadingCompras } = useQuery({
    queryKey: ['todasComprasRifa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compras_rifa')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CompraRifa[];
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const criarRifa = async (payload: Partial<Rifa>): Promise<string | null> => {
    const { data, error } = await supabase
      .from('rifas')
      .insert([payload])
      .select('id')
      .single();
    if (error) {
      toast.error('Erro ao criar rifa: ' + error.message);
      return null;
    }
    const rifaId = data.id as string;
    const { error: errPop } = await supabase.rpc('popular_numeros_rifa', {
      p_rifa_id: rifaId,
      p_inicio: payload.numero_inicial ?? 1,
      p_quantidade: payload.quantidade_numeros ?? 100,
    });
    if (errPop) {
      toast.error('Rifa criada, mas erro ao popular números: ' + errPop.message);
    } else {
      toast.success('Rifa criada com sucesso!');
    }
    queryClient.invalidateQueries({ queryKey: ['rifasAdmin'] });
    queryClient.invalidateQueries({ queryKey: ['rifas'] });
    queryClient.invalidateQueries({ queryKey: ['numerosRifa'] });
    return rifaId;
  };

  const atualizarRifa = async (rifaId: string, payload: Partial<Rifa>): Promise<boolean> => {
    const { error } = await supabase.from('rifas').update(payload).eq('id', rifaId);
    if (error) {
      toast.error('Erro ao atualizar rifa.');
      return false;
    }
    toast.success('Rifa atualizada!');
    queryClient.invalidateQueries({ queryKey: ['rifasAdmin'] });
    queryClient.invalidateQueries({ queryKey: ['rifas'] });
    return true;
  };

  const finalizarRifa = async (rifaId: string, numeroGanhador: number): Promise<boolean> => {
    const { data, error } = await supabase.rpc('finalizar_rifa', {
      p_rifa_id: rifaId,
      p_numero_ganhador: numeroGanhador,
    });
    if (error || !data?.success) {
      const msg = data?.error;
      if (msg === 'unauthorized') toast.error('Ação não autorizada.');
      else toast.error('Erro ao finalizar rifa.');
      return false;
    }
    toast.success('Rifa finalizada! Ganhador registrado.');
    queryClient.invalidateQueries({ queryKey: ['rifasAdmin'] });
    queryClient.invalidateQueries({ queryKey: ['rifas'] });
    queryClient.invalidateQueries({ queryKey: ['numerosRifa'] });
    return true;
  };

  const deletarRifa = async (rifaId: string): Promise<boolean> => {
    const { error } = await supabase.from('rifas').delete().eq('id', rifaId);
    if (error) {
      toast.error('Erro ao deletar rifa.');
      return false;
    }
    toast.success('Rifa deletada.');
    queryClient.invalidateQueries({ queryKey: ['rifasAdmin'] });
    queryClient.invalidateQueries({ queryKey: ['rifas'] });
    return true;
  };

  const cancelarRifa = async (rifaId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('rifas')
      .update({ status: 'cancelada' })
      .eq('id', rifaId);
    if (error) {
      toast.error('Erro ao cancelar rifa.');
      return false;
    }
    toast.success('Rifa cancelada.');
    queryClient.invalidateQueries({ queryKey: ['rifasAdmin'] });
    queryClient.invalidateQueries({ queryKey: ['rifas'] });
    return true;
  };

  const criarVendedor = async (payload: Partial<VendedorRifa>): Promise<boolean> => {
    const { error } = await supabase.from('vendedores_rifa').insert([payload]);
    if (error) {
      toast.error('Erro ao criar vendedor.');
      return false;
    }
    toast.success('Vendedor criado!');
    queryClient.invalidateQueries({ queryKey: ['vendedoresRifa'] });
    return true;
  };

  const atualizarVendedor = async (vendedorId: string, payload: Partial<VendedorRifa>): Promise<boolean> => {
    const { error } = await supabase.from('vendedores_rifa').update(payload).eq('id', vendedorId);
    if (error) {
      toast.error('Erro ao atualizar vendedor.');
      return false;
    }
    toast.success('Vendedor atualizado!');
    queryClient.invalidateQueries({ queryKey: ['vendedoresRifa'] });
    return true;
  };

  const getNumerosRifaAdmin = async (rifaId: string): Promise<NumeroRifa[]> => {
    const { data, error } = await supabase
      .from('numeros_rifa')
      .select('*')
      .eq('rifa_id', rifaId)
      .order('numero');
    if (error) return [];
    return data as NumeroRifa[];
  };

  const getCartelasCompra = async (compraId: string): Promise<CartelaRifa[]> => {
    const { data, error } = await supabase
      .from('cartelas_rifa')
      .select('*')
      .eq('compra_id', compraId);
    if (error) return [];
    return data as CartelaRifa[];
  };

  const registrarVendaVendedor = async (
    rifaId: string,
    vendedorId: string,
    numeros: number[],
    clienteId?: string,
  ): Promise<boolean> => {
    const { data: rifaData } = await supabase
      .from('rifas')
      .select('custo_por_numero')
      .eq('id', rifaId)
      .single();
    if (!rifaData) { toast.error('Rifa não encontrada.'); return false; }

    const { data: vendedorData } = await supabase
      .from('vendedores_rifa')
      .select('percentual_desconto')
      .eq('id', vendedorId)
      .single();

    const desconto = vendedorData?.percentual_desconto ?? 0;
    const valorBruto = numeros.length * rifaData.custo_por_numero;
    const valorFinal = valorBruto * (1 - desconto / 100);

    for (const num of numeros) {
      const { error } = await supabase
        .from('numeros_rifa')
        .update({ status: 'vendido', vendedor_id: vendedorId, cliente_rifa_id: clienteId ?? null })
        .eq('rifa_id', rifaId)
        .eq('numero', num)
        .eq('status', 'disponivel');
      if (error) {
        toast.error(`Erro ao reservar número ${num}.`);
        return false;
      }
    }

    const { data: compraData, error: compraErr } = await supabase
      .from('compras_rifa')
      .insert([{
        rifa_id: rifaId,
        vendedor_id: vendedorId,
        cliente_rifa_id: clienteId ?? null,
        numeros,
        valor_total: valorFinal,
        desconto_aplicado: desconto,
        tipo_pagamento: 'vendedor',
      }])
      .select('id')
      .single();

    if (compraErr || !compraData) { toast.error('Erro ao registrar compra.'); return false; }

    const numerosIds = await supabase
      .from('numeros_rifa')
      .select('id, numero')
      .eq('rifa_id', rifaId)
      .in('numero', numeros);

    if (numerosIds.data && numerosIds.data.length > 0) {
      const cartelas = numerosIds.data.map(n => ({
        numero_rifa_id: n.id,
        compra_id: compraData.id,
      }));
      await supabase.from('cartelas_rifa').insert(cartelas);
    }

    toast.success(`Venda de ${numeros.length} número(s) registrada!`);
    queryClient.invalidateQueries({ queryKey: ['numerosRifa'] });
    queryClient.invalidateQueries({ queryKey: ['todasComprasRifa'] });
    return true;
  };

  return {
    todasRifas,
    vendedores,
    clientes,
    todasCompras,
    isLoading: isLoadingRifas || isLoadingVendedores || isLoadingCompras,
    criarRifa,
    atualizarRifa,
    deletarRifa,
    finalizarRifa,
    cancelarRifa,
    criarVendedor,
    atualizarVendedor,
    getNumerosRifaAdmin,
    getCartelasCompra,
    registrarVendaVendedor,
  };
};
