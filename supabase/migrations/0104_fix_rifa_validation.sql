-- Adiciona a coluna para salvar o comprovante na compra da rifa
ALTER TABLE public.compras_rifa ADD COLUMN IF NOT EXISTS comprovante_url TEXT;

-- Atualiza a função de validação para buscar primeiro no Bingo e depois na Rifa
CREATE OR REPLACE FUNCTION public.enviar_comprovante_cliente_bingo(p_codigo text, p_nome text, p_telefone text DEFAULT NULL::text, p_endereco text DEFAULT NULL::text, p_comprovante text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_venda_bingo_id uuid;
  v_cartela_rifa record;
BEGIN
  -- 1. Tenta achar no Bingo Físico
  SELECT id INTO v_venda_bingo_id 
  FROM public.vendas_bingo_fisico 
  WHERE upper(codigo_validacao) = upper(p_codigo) 
    AND status = 'pendente'
  LIMIT 1;
  
  IF v_venda_bingo_id IS NOT NULL THEN 
    UPDATE public.vendas_bingo_fisico 
    SET status = 'em_analise', 
        nome_comprador = p_nome, 
        telefone_comprador = p_telefone, 
        endereco_comprador = p_endereco,
        comprovante_url = p_comprovante
    WHERE id = v_venda_bingo_id;
    
    RETURN jsonb_build_object('success', true); 
  END IF;

  -- 2. Tenta achar na Rifa
  SELECT cr.id as cartela_id, cr.compra_id, c.status as compra_status, n.id as numero_id
  INTO v_cartela_rifa
  FROM public.cartelas_rifa cr
  JOIN public.compras_rifa c ON c.id = cr.compra_id
  JOIN public.numeros_rifa n ON n.id = cr.numero_rifa_id
  WHERE upper(cr.codigo_validacao) = upper(p_codigo)
  LIMIT 1;

  IF FOUND THEN
    IF v_cartela_rifa.compra_status != 'pendente' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Esta cota não está pendente de pagamento.');
    END IF;

    -- Atualiza a compra para em análise e salva o comprovante
    UPDATE public.compras_rifa
    SET status = 'em_analise',
        comprovante_url = p_comprovante
    WHERE id = v_cartela_rifa.compra_id;

    -- Atualiza os dados do comprador no numero_rifa
    UPDATE public.numeros_rifa
    SET nome_comprador = p_nome,
        telefone_comprador = p_telefone,
        endereco_comprador = p_endereco
    WHERE id = v_cartela_rifa.numero_id;

    RETURN jsonb_build_object('success', true);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Cartela ou Cota não encontrada ou já validada.');
END;
$function$;

-- Função para APROVAR pagamento de RIFA pelo Admin
CREATE OR REPLACE FUNCTION public.aprovar_pagamento_cliente_rifa(p_venda_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_compra record;
  v_vendedor record;
  v_cfg record;
  v_comissao_perc numeric;
  v_comissao_valor numeric;
  v_preco_total_compra numeric;
BEGIN
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;

  SELECT * INTO v_compra FROM public.compras_rifa WHERE id = p_venda_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;

  IF v_compra.status != 'em_analise' THEN
    RETURN jsonb_build_object('success', false, 'error', 'compra_nao_esta_em_analise');
  END IF;

  SELECT * INTO v_vendedor FROM public.vendedores_rifa WHERE id = v_compra.vendedor_id;
  SELECT * INTO v_cfg FROM public.configuracoes LIMIT 1;

  IF v_compra.desconto_aplicado < 100 AND v_compra.desconto_aplicado > 0 THEN
    v_preco_total_compra := v_compra.valor_total / (1 - (v_compra.desconto_aplicado / 100.0));
  ELSE
    v_preco_total_compra := v_compra.valor_total;
  END IF;

  UPDATE public.compras_rifa SET status = 'pago' WHERE id = p_venda_id;

  -- Comissão
  v_comissao_perc := v_vendedor.comissao_percentual;
  IF v_comissao_perc IS NULL OR v_comissao_perc = 0 THEN
    v_comissao_perc := COALESCE(v_cfg.comissao_vendedor_global, 0);
  END IF;

  IF v_comissao_perc > 0 THEN
    v_comissao_valor := v_preco_total_compra * (v_comissao_perc / 100.0);
    UPDATE public.perfis SET credits = credits + v_comissao_valor WHERE id = v_vendedor.user_id;
    PERFORM public.increment_admin_profit(-v_comissao_valor);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Função para REJEITAR pagamento de RIFA pelo Admin
CREATE OR REPLACE FUNCTION public.rejeitar_pagamento_cliente_rifa(p_venda_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); END IF;

  UPDATE public.compras_rifa 
  SET status = 'pendente', 
      comprovante_url = NULL 
  WHERE id = p_venda_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;