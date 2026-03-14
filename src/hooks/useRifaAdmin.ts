import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Rifa, NumeroRifa, CompraRifa, VendedorRifa, ClienteRifa, CartelaRifa, SolicitacaoVendedor, CadastroVendedor, AcertoVendedor } from '@/types/rifa';

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
        .select('*, rifas(nome), cartelas_rifa(codigo_validacao)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const { data: todasFolhasBingo = [] } = useQuery({
    queryKey: ['todasFolhasBingoAdmin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas_bingo_fisico')
        .select('*, partidas(name), vendedores_rifa(nome, codigo_ref)'); 
      if (error) throw error;
      return data as any[];
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const { data: solicitacoesVendedor = [], isLoading: isLoadingSolicitacoes } = useQuery({
    queryKey: ['solicitacoesVendedor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes_vendedor')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('[useRifaAdmin] Erro ao buscar solicitações:', error);
        throw error;
      }

      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map(s => s.user_id))];
      const { data: profilesData } = await supabase
        .from('perfis')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      return data.map(s => ({
        ...s,
        perfis: profilesData?.find(p => p.id === s.user_id) || null
      })) as SolicitacaoVendedor[];
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const { data: acertosPendentes = [] } = useQuery({
    queryKey: ['acertosAdmin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acertos_vendedor')
        .select('*, vendedores_rifa(nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AcertoVendedor[];
    },
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const { data: vendedoresComStats = [] } = useQuery({
    queryKey: ['vendedoresComStats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores_rifa')
        .select('*')
        .order('nome');
        
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = [...new Set(data.map(v => v.user_id).filter(Boolean))];
      
      let profilesData: any[] = [];
      let cadastrosData: any[] = [];
      
      if (userIds.length > 0) {
        const [resPerfis, resCadastros] = await Promise.all([
          supabase.from('perfis').select('id, full_name, avatar_url').in('id', userIds),
          supabase.from('cadastro_vendedor').select('*').in('user_id', userIds)
        ]);
        
        profilesData = resPerfis.data || [];
        cadastrosData = resCadastros.data || [];
      }

      return data.map(v => ({
        ...v,
        perfis: profilesData?.find(p => p.id === v.user_id) || null,
        cadastro: cadastrosData?.find(c => c.user_id === v.user_id) || null
      }));
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

  const uploadImagemRifa = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const filePath = `rifa_img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    
    const { error } = await supabase.storage.from('avatars').upload(filePath, file);
    if (error) { 
      toast.error(`Erro ao enviar imagem: ${error.message}`); 
      return null; 
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const atualizarRifa = async (rifaId: string, payload: Partial<Rifa>): Promise<boolean> => {
    const clean = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    );
    const { data, error } = await supabase.from('rifas').update(clean).eq('id', rifaId).select();
    
    if (error) {
      toast.error('Erro ao atualizar rifa: ' + error.message);
      return false;
    }
    if (!data || data.length === 0) {
      toast.error('Erro de permissão: A rifa não foi salva (Atualize as políticas do Supabase).');
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
    const { data, error } = await supabase.from('rifas').delete().eq('id', rifaId).select();
    if (error) {
      toast.error('Erro ao deletar rifa.');
      return false;
    }
    if (!data || data.length === 0) {
      toast.error('A rifa não pôde ser apagada (Verifique permissões RLS).');
      return false;
    }
    toast.success('Rifa deletada.');
    queryClient.invalidateQueries({ queryKey: ['rifasAdmin'] });
    queryClient.invalidateQueries({ queryKey: ['rifas'] });
    return true;
  };

  const cancelarRifa = async (rifaId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('rifas')
      .update({ status: 'cancelada' })
      .eq('id', rifaId)
      .select();
    if (error) {
      toast.error('Erro ao cancelar rifa.');
      return false;
    }
    if (!data || data.length === 0) {
      toast.error('Erro ao cancelar: Sem permissão RLS.');
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
    queryClient.invalidateQueries({ queryKey: ['vendedoresComStats'] });
    return true;
  };

  const salvarEdicaoCompletaVendedor = async (
    vendedorId: string, 
    userId: string, 
    payloadRifa: Partial<VendedorRifa>, 
    payloadCadastro: Partial<CadastroVendedor>
  ): Promise<boolean> => {
    const { error: err1 } = await supabase.from('vendedores_rifa').update(payloadRifa).eq('id', vendedorId);
    if (err1) {
      toast.error(`Erro ao atualizar taxas do vendedor: ${err1.message}`);
      return false;
    }

    if (userId && payloadCadastro) {
      const { data: existing } = await supabase.from('cadastro_vendedor').select('id').eq('user_id', userId).maybeSingle();
      if (existing) {
        const { error: err2 } = await supabase.from('cadastro_vendedor').update(payloadCadastro).eq('user_id', userId);
        if (err2) { toast.error(`Erro ao atualizar cadastro: ${err2.message}`); return false; }
      } else {
        const { error: err3 } = await supabase.from('cadastro_vendedor').insert({ user_id: userId, ...payloadCadastro });
        if (err3) { toast.error(`Erro ao inserir cadastro: ${err3.message}`); return false; }
      }
    }

    toast.success('Dados do vendedor atualizados com sucesso!');
    queryClient.invalidateQueries({ queryKey: ['vendedoresComStats'] });
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

  const aprovarVendedor = async (solicitacaoId: string, mensagemAdmin?: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('aprovar_vendedor', {
      p_solicitacao_id: solicitacaoId,
      p_comissao: 0,
      p_desconto: 0,
      p_mensagem_admin: mensagemAdmin ?? null,
    });

    if (error) {
      toast.error(`Erro no servidor: ${error.message}`);
      return false;
    }

    if (!data?.success) {
      toast.error('Não foi possível aprovar: ' + (data?.error ?? 'Erro desconhecido'));
      return false;
    }

    toast.success('Vendedor aprovado!');
    queryClient.invalidateQueries({ queryKey: ['solicitacoesVendedor'] });
    queryClient.invalidateQueries({ queryKey: ['vendedoresRifa'] });
    queryClient.invalidateQueries({ queryKey: ['vendedoresComStats'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return true;
  };

  const rejeitarVendedor = async (solicitacaoId: string, mensagemAdmin?: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('rejeitar_vendedor', {
      p_solicitacao_id: solicitacaoId,
      p_mensagem_admin: mensagemAdmin ?? null,
    });

    if (error) {
      toast.error(`Erro no servidor: ${error.message}`);
      return false;
    }

    if (!data?.success) {
      toast.error('Erro ao rejeitar: ' + (data?.error ?? 'Erro desconhecido'));
      return false;
    }

    toast.success('Solicitação rejeitada.');
    queryClient.invalidateQueries({ queryKey: ['solicitacoesVendedor'] });
    return true;
  };

  const resolverAcerto = async (acertoId: string, status: 'aprovado' | 'rejeitado'): Promise<boolean> => {
    let amountToDirectProfit = 0;
    let sellerCommissionToPay = 0;
    let sellerUserId = null;

    if (status === 'aprovado') {
      const { data: acerto } = await supabase
          .from('acertos_vendedor')
          .select('*, vendedores_rifa(user_id, comissao_percentual)')
          .eq('id', acertoId)
          .single();
      
      if (acerto) {
        sellerUserId = acerto.vendedores_rifa?.user_id;
        
        const { data: cfg } = await supabase.from('configuracoes').select('comissao_vendedor_global').single();
        const comissaoPerc = Number(acerto.vendedores_rifa?.comissao_percentual || cfg?.comissao_vendedor_global || 0);

        let bingoProfit = 0;
        let rifaProfit = 0;

        if (acerto.bingo_ids && acerto.bingo_ids.length > 0) {
          const { data: bingos } = await supabase.from('vendas_bingo_fisico')
            .select('valor_pago, partidas(status)')
            .in('id', acerto.bingo_ids);
            
          bingos?.forEach(b => {
            const val = Number(b.valor_pago);
            if (b.partidas?.status === 'finished') {
              bingoProfit += val; 
            }
            sellerCommissionToPay += val * (comissaoPerc / 100.0); 
          });
        }

        if (acerto.rifa_ids && acerto.rifa_ids.length > 0) {
           const { data: rifas } = await supabase.from('compras_rifa')
            .select('valor_total')
            .in('id', acerto.rifa_ids);
            
           rifas?.forEach(r => {
              const val = Number(r.valor_total);
              rifaProfit += val; 
              sellerCommissionToPay += val * (comissaoPerc / 100.0); 
           });
        }

        amountToDirectProfit = bingoProfit + rifaProfit - sellerCommissionToPay;
      }
    }

    const { data, error } = await supabase.rpc('resolver_acerto_vendedor', {
      p_acerto_id: acertoId,
      p_status: status
    });

    if (error || !data?.success) {
      toast.error(`Erro ao ${status === 'aprovado' ? 'aprovar' : 'rejeitar'} o acerto financeiro.`);
      return false;
    }

    if (status === 'aprovado') {
      if (amountToDirectProfit !== 0) {
        await supabase.rpc('increment_admin_profit', { amount: amountToDirectProfit });
      }
      if (sellerCommissionToPay > 0 && sellerUserId) {
        await supabase.rpc('increment_player_credits', { p_player_id: sellerUserId, p_amount: sellerCommissionToPay });
      }
      queryClient.invalidateQueries({ queryKey: ['gameSettings'] }); 
      queryClient.invalidateQueries({ queryKey: ['players'] });
    }

    toast.success(`Acerto ${status} com sucesso!`);
    queryClient.invalidateQueries({ queryKey: ['acertosAdmin'] });
    queryClient.invalidateQueries({ queryKey: ['todasComprasRifa'] });
    return true;
  };

  // Nova função para forçar o repasse caso o sistema tenha falhado anteriormente
  const forcarRepasseAcerto = async (acertoId: string): Promise<boolean> => {
    let amountToDirectProfit = 0;
    let sellerCommissionToPay = 0;
    let sellerUserId = null;

    const { data: acerto } = await supabase
        .from('acertos_vendedor')
        .select('*, vendedores_rifa(user_id, comissao_percentual)')
        .eq('id', acertoId)
        .single();
    
    if (!acerto) {
      toast.error("Acerto não encontrado.");
      return false;
    }

    sellerUserId = acerto.vendedores_rifa?.user_id;
    
    const { data: cfg } = await supabase.from('configuracoes').select('comissao_vendedor_global').single();
    const comissaoPerc = Number(acerto.vendedores_rifa?.comissao_percentual || cfg?.comissao_vendedor_global || 0);

    let bingoProfit = 0;
    let rifaProfit = 0;

    if (acerto.bingo_ids && acerto.bingo_ids.length > 0) {
      const { data: bingos } = await supabase.from('vendas_bingo_fisico').select('valor_pago, partidas(status)').in('id', acerto.bingo_ids);
      bingos?.forEach(b => {
        const val = Number(b.valor_pago);
        if (b.partidas?.status === 'finished') bingoProfit += val;
        sellerCommissionToPay += val * (comissaoPerc / 100.0);
      });
    }

    if (acerto.rifa_ids && acerto.rifa_ids.length > 0) {
       const { data: rifas } = await supabase.from('compras_rifa').select('valor_total').in('id', acerto.rifa_ids);
       rifas?.forEach(r => {
          const val = Number(r.valor_total);
          rifaProfit += val;
          sellerCommissionToPay += val * (comissaoPerc / 100.0);
       });
    }

    amountToDirectProfit = bingoProfit + rifaProfit - sellerCommissionToPay;

    if (amountToDirectProfit !== 0) {
      await supabase.rpc('increment_admin_profit', { amount: amountToDirectProfit });
    }
    if (sellerCommissionToPay > 0 && sellerUserId) {
      await supabase.rpc('increment_player_credits', { p_player_id: sellerUserId, p_amount: sellerCommissionToPay });
    }
    
    queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
    queryClient.invalidateQueries({ queryKey: ['players'] });
    toast.success("Saldos e comissões repassados forçadamente com sucesso!");
    return true;
  };

  return {
    todasRifas,
    vendedores,
    vendedoresComStats,
    clientes,
    todasCompras,
    todasFolhasBingo,
    solicitacoesVendedor,
    acertosPendentes,
    isLoading: isLoadingRifas || isLoadingVendedores || isLoadingCompras,
    isLoadingSolicitacoes,
    criarRifa,
    atualizarRifa,
    deletarRifa,
    finalizarRifa,
    cancelarRifa,
    uploadImagemRifa,
    criarVendedor,
    atualizarVendedor,
    salvarEdicaoCompletaVendedor,
    aprovarVendedor,
    rejeitarVendedor,
    getNumerosRifaAdmin,
    getCartelasCompra,
    registrarVendaVendedor,
    resolverAcerto,
    forcarRepasseAcerto,
  };
};