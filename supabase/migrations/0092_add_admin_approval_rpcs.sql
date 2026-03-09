-- 1. Função para Aprovar Pagamento Direto do Cliente (PIX no seu bolso)
CREATE OR REPLACE FUNCTION public.aprovar_pagamento_cliente_bingo(p_venda_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_venda record;
  v_vendedor record;
  v_cfg record;
  v_comissao_perc numeric;
  v_comissao_valor numeric;
  v_preco_total_cartela numeric;
BEGIN
  -- Verificar se é admin
  IF NOT public.is_admin() THEN 
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); 
  END IF;

  -- Buscar dados da venda
  SELECT * INTO v_venda FROM public.vendas_bingo_fisico WHERE id = p_venda_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;

  IF v_venda.status != 'em_analise' THEN
    RETURN jsonb_build_object('success', false, 'error', 'venda_nao_esta_em_analise');
  END IF;

  -- Buscar vendedor e configurações
  SELECT * INTO v_vendedor FROM public.vendedores_rifa WHERE id = v_venda.vendedor_id;
  SELECT * INTO v_cfg FROM public.configuracoes LIMIT 1;

  -- Calcular o preço cheio da cartela (antes do desconto do vendedor)
  -- Se o vendedor tem 20% de desconto, valor_pago = Preço * 0.8 -> Preço = valor_pago / 0.8
  IF v_venda.desconto_aplicado < 100 THEN
    v_preco_total_cartela := v_venda.valor_pago / (1 - (v_venda.desconto_aplicado / 100.0));
  ELSE
    v_preco_total_cartela := v_venda.valor_pago;
  END IF;

  -- 1. Atualizar status da venda
  UPDATE public.vendas_bingo_fisico SET status = 'pago' WHERE id = p_venda_id;

  -- 2. Adicionar valor ao pote da partida (Pote recebe o valor real que o cliente pagou)
  UPDATE public.partidas SET pot = pot + v_preco_total_cartela WHERE id = v_venda.match_id;

  -- 3. Pagar comissão ao vendedor (Pois ele fez a venda mas o cliente pagou direto para o admin)
  v_comissao_perc := COALESCE(v_vendedor.comissao_percentual, v_cfg.comissao_vendedor_global, 0);
  
  IF v_comissao_perc > 0 THEN
    v_comissao_valor := v_preco_total_cartela * (v_comissao_perc / 100.0);
    
    -- Credita no saldo do vendedor
    UPDATE public.perfis 
    SET credits = credits + v_comissao_valor 
    WHERE id = v_vendedor.user_id;

    -- O valor da comissão sai do lucro do admin para manter o pote íntegro
    PERFORM public.increment_admin_profit(-v_comissao_valor);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 2. Função para Rejeitar Pagamento (Comprovante falso ou errado)
CREATE OR REPLACE FUNCTION public.rejeitar_pagamento_cliente_bingo(p_venda_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.is_admin() THEN 
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized'); 
  END IF;

  UPDATE public.vendas_bingo_fisico 
  SET status = 'pendente', 
      comprovante_url = NULL 
  WHERE id = p_venda_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;