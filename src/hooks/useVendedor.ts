import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { VendedorRifa, NumeroRifa, CompraRifa, AcertoVendedor } from '@/types/rifa';

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

  const { data: meusAcertos = [], isLoading: isLoadingAcertos } = useQuery({
    queryKey: ['meusAcertosVendedor', meuVendedor?.id],
    queryFn: async () => {
      if (!meuVendedor) return [];
      const { data, error } = await supabase
        .from('acertos_vendedor')
        .select('*')
        .eq('vendedor_id', meuVendedor.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AcertoVendedor[];
    },
    enabled: !!meuVendedor,
    refetchInterval: 5000,
  });

  const reservarNumeros = async (rifaId: string, numeros: number[], pagarDepois: boolean = false): Promise<boolean> => {
    const { data, error } = await supabase.rpc('reservar_numeros_vendedor', {
      p_rifa_id: rifaId,
      p_numeros: numeros,
      p_pagar_depois: pagarDepois,
    });
    if (error || !data?.success) {
      const msg = data?.error;
      if (msg === 'not_a_vendor') toast.error('Você não está cadastrado como vendedor ativo.');
      else if (msg === 'rifa_not_found') toast.error('Rifa não encontrada ou encerrada.');
      else if (msg === 'insufficient_credits') toast.error('Créditos insuficientes. Marque a opção "Gerar Fiado" se precisar.');
      else if (msg?.startsWith('numero_indisponivel')) {
        const num = msg.split(':')[1];
        toast.error(`Número ${num} não está disponível.`);
      } else toast.error('Erro ao reservar números.');
      return false;
    }
    const preco = data.preco_unitario;
    if (pagarDepois) {
      toast.success(`${numeros.length} número(s) reservado(s) no FIADO. Pague para ativar.`);
    } else {
      toast.success(`${numeros.length} número(s) reservado(s)! Preço: R$ ${Number(preco).toFixed(2)} cada.`);
    }
    queryClient.invalidateQueries({ queryKey: ['minhasReservasVendedor'] });
    queryClient.invalidateQueries({ queryKey: ['minhasVendasVendedor'] });
    queryClient.invalidateQueries({ queryKey: ['numerosRifa'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return true;
  };

  const enviarAcerto = async (bingoIds: string[], rifaIds: string[], valor: number, file: File): Promise<boolean> => {
    if (!meuVendedor || !user) return false;
    
    try {
      const fileName = `acertos/${meuVendedor.id}/${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
      if (uploadError) throw new Error('Falha ao enviar comprovante.');

      const { data, error } = await supabase.rpc('enviar_acerto_vendedor', {
        p_vendedor_id: meuVendedor.id,
        p_bingo_ids: bingoIds,
        p_rifa_ids: rifaIds,
        p_valor: valor,
        p_comprovante: fileName
      });

      if (error || !data?.success) throw new Error('Falha ao registrar acerto.');

      toast.success('Acerto enviado com sucesso! Aguarde a aprovação do Administrador.');
      queryClient.invalidateQueries({ queryKey: ['meusAcertosVendedor'] });
      queryClient.invalidateQueries({ queryKey: ['folhasBingoFisico'] });
      queryClient.invalidateQueries({ queryKey: ['minhasVendasVendedor'] });
      return true;

    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar acerto.');
      return false;
    }
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
    queryClient.invalidateQueries({ queryKey: ['minhasReservasVendedor'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return true;
  };

  const validarMultiplasVendas = async (
    numeroRifaIds: string[],
    nome: string,
    telefone: string,
    endereco: string,
  ): Promise<boolean> => {
    let successCount = 0;
    let totalComissao = 0;

    for (const id of numeroRifaIds) {
      const { data, error } = await supabase.rpc('validar_venda_vendedor', {
        p_numero_rifa_id: id,
        p_nome_comprador: nome,
        p_telefone_comprador: telefone || null,
        p_endereco_comprador: endereco || null,
      });

      if (!error && data?.success) {
        successCount++;
        totalComissao += Number(data.comissao_creditada || 0);
      }
    }

    if (successCount === 0) {
      toast.error('Erro ao validar as vendas. Verifique se os números já não foram validados.');
      return false;
    }

    if (successCount < numeroRifaIds.length) {
      toast.warning(`Atenção: Apenas ${successCount} de ${numeroRifaIds.length} números foram validados com sucesso.`);
    } else {
      if (totalComissao > 0) {
        toast.success(`${successCount} venda(s) validada(s) em lote! +${totalComissao.toFixed(2)} créditos de comissão.`);
      } else {
        toast.success(`${successCount} venda(s) validada(s) em lote com sucesso!`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['minhasReservasVendedor'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
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
    toast.success(`Reserva cancelada!${estorno > 0 ? ` +${estorno.toFixed(2)} créditos estornados.` : ' (Fiado estornado)'}`);
    queryClient.invalidateQueries({ queryKey: ['minhasReservasVendedor'] });
    queryClient.invalidateQueries({ queryKey: ['minhasVendasVendedor'] });
    queryClient.invalidateQueries({ queryKey: ['numerosRifa'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
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
    meusAcertos,
    isLoading: isLoadingVendedor || isLoadingReservas || isLoadingVendas || isLoadingAcertos,
    reservarNumeros,
    cancelarReserva,
    validarVenda,
    validarMultiplasVendas,
    gerarLink,
    enviarAcerto,
  };
};