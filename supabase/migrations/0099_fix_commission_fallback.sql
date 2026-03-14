-- Corrigindo validar_cartela_publica
CREATE OR REPLACE FUNCTION public.validar_cartela_publica(
  p_codigo text,
  p_nome text,
  p_telefone text DEFAULT NULL::text,
  p_endereco text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_venda_bingo record;
  v_cartela_rifa record;
  v_vendedor record;
  v_cfg record;
  v_comissao_perc numeric;
  v_comissao_valor numeric;
  v_preco_total numeric;
BEGIN
  SELECT * INTO v_cfg FROM configuracoes LIMIT 1;

  -- 1. Tenta achar no Bingo Físico
  SELECT * INTO v_venda_bingo FROM vendas_bingo_fisico WHERE upper(codigo_validacao) = upper(p_codigo);
  
  IF FOUND THEN
    IF v_venda_bingo.nome_comprador IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cartela já validada anteriormente.');
    END IF;

    IF v_venda_bingo.status != 'pago' THEN
      RETURN jsonb_build_object('success', false, 'error', 'A cartela precisa ser paga antes de validar os dados.');
    END IF;

    -- Atualiza os dados da folha de bingo
    UPDATE vendas_bingo_fisico 
    SET nome_comprador = p_nome, telefone_comprador = p_telefone, endereco_comprador = p_endereco 
    WHERE id = v_venda_bingo.id;

    -- Paga a comissão (já que agora os dados foram validados)
    IF v_venda_bingo.vendedor_id IS NOT NULL THEN
      SELECT * INTO v_vendedor FROM vendedores_rifa WHERE id = v_venda_bingo.vendedor_id;
      
      -- Descobre o preço sem desconto
      IF v_venda_bingo.desconto_aplicado < 100 AND v_venda_bingo.desconto_aplicado > 0 THEN
        v_preco_total := v_venda_bingo.valor_pago / (1 - (v_venda_bingo.desconto_aplicado / 100.0));
      ELSE
        v_preco_total := v_venda_bingo.valor_pago;
      END IF;

      v_comissao_perc := v_vendedor.comissao_percentual;
      IF v_comissao_perc IS NULL OR v_comissao_perc = 0 THEN
        v_comissao_perc := COALESCE(v_cfg.comissao_vendedor_global, 0);
      END IF;

      IF v_comissao_perc > 0 THEN
        v_comissao_valor := v_preco_total * (v_comissao_perc / 100.0);
        UPDATE perfis SET credits = credits + v_comissao_valor WHERE id = v_vendedor.user_id;
        -- Deduz a comissão do lucro do admin (pois o admin recebeu o valor cheio via stripe)
        PERFORM increment_admin_profit(-v_comissao_valor);
      END IF;
    END IF;

    RETURN jsonb_build_object('success', true);
  END IF;

  -- 2. Tenta achar na Rifa
  SELECT cr.*, c.status as compra_status, c.vendedor_id, c.valor_total, c.desconto_aplicado, c.numeros, c.rifa_id, n.id as numero_id, n.nome_comprador
  INTO v_cartela_rifa
  FROM cartelas_rifa cr
  JOIN compras_rifa c ON c.id = cr.compra_id
  JOIN numeros_rifa n ON n.id = cr.numero_rifa_id
  WHERE upper(cr.codigo_validacao) = upper(p_codigo);

  IF FOUND THEN
    IF v_cartela_rifa.nome_comprador IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Bilhete já validado anteriormente.');
    END IF;

    IF v_cartela_rifa.compra_status != 'pago' THEN
      RETURN jsonb_build_object('success', false, 'error', 'A cartela precisa ser paga antes de validar os dados.');
    END IF;

    -- Atualiza os dados no numero da rifa
    UPDATE numeros_rifa 
    SET nome_comprador = p_nome, telefone_comprador = p_telefone, endereco_comprador = p_endereco 
    WHERE id = v_cartela_rifa.numero_id;

    -- Verifica se já foi paga a comissão desta compra.
    IF NOT EXISTS (SELECT 1 FROM numeros_rifa WHERE rifa_id = v_cartela_rifa.rifa_id AND numero = ANY(v_cartela_rifa.numeros) AND nome_comprador IS NOT NULL AND id != v_cartela_rifa.numero_id) THEN
        IF v_cartela_rifa.vendedor_id IS NOT NULL THEN
          SELECT * INTO v_vendedor FROM vendedores_rifa WHERE id = v_cartela_rifa.vendedor_id;
          
          IF v_cartela_rifa.desconto_aplicado < 100 AND v_cartela_rifa.desconto_aplicado > 0 THEN
            v_preco_total := v_cartela_rifa.valor_total / (1 - (v_cartela_rifa.desconto_aplicado / 100.0));
          ELSE
            v_preco_total := v_cartela_rifa.valor_total;
          END IF;

          v_comissao_perc := v_vendedor.comissao_percentual;
          IF v_comissao_perc IS NULL OR v_comissao_perc = 0 THEN
             v_comissao_perc := COALESCE(v_cfg.comissao_vendedor_global, 0);
          END IF;

          IF v_comissao_perc > 0 THEN
            v_comissao_valor := v_preco_total * (v_comissao_perc / 100.0);
            UPDATE perfis SET credits = credits + v_comissao_valor WHERE id = v_vendedor.user_id;
            PERFORM increment_admin_profit(-v_comissao_valor);
          END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Código de validação não encontrado.');
END;
$function$;

-- Corrigindo aprovar_pagamento_cliente_bingo
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
  IF v_venda.desconto_aplicado < 100 AND v_venda.desconto_aplicado > 0 THEN
    v_preco_total_cartela := v_venda.valor_pago / (1 - (v_venda.desconto_aplicado / 100.0));
  ELSE
    v_preco_total_cartela := v_venda.valor_pago;
  END IF;

  -- 1. Atualizar status da venda
  UPDATE public.vendas_bingo_fisico SET status = 'pago' WHERE id = p_venda_id;

  -- 2. Adicionar valor ao pote da partida
  UPDATE public.partidas SET pot = pot + v_preco_total_cartela WHERE id = v_venda.match_id;

  -- 3. Pagar comissão ao vendedor
  v_comissao_perc := v_vendedor.comissao_percentual;
  IF v_comissao_perc IS NULL OR v_comissao_perc = 0 THEN
    v_comissao_perc := COALESCE(v_cfg.comissao_vendedor_global, 0);
  END IF;
  
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

-- Corrigindo comprar_numeros_via_ref (compra com saldo de cliente online via link)
CREATE OR REPLACE FUNCTION public.comprar_numeros_via_ref(p_rifa_id uuid, p_numeros integer[], p_ref_codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_rifa rifas%ROWTYPE;
  v_vendedor_id UUID;
  v_comissao NUMERIC;
  v_total NUMERIC;
  v_comissao_valor NUMERIC;
  v_compra_id UUID;
  v_num INT;
  v_cfg configuracoes%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_rifa FROM rifas WHERE id = p_rifa_id AND status = 'ativa' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'rifa_not_found');
  END IF;

  SELECT id, comissao_percentual INTO v_vendedor_id, v_comissao
  FROM vendedores_rifa WHERE codigo_ref = p_ref_codigo AND ativo = true;

  SELECT * INTO v_cfg FROM configuracoes LIMIT 1;
  IF v_comissao IS NULL OR v_comissao = 0 THEN
    v_comissao := COALESCE(v_cfg.comissao_vendedor_global, 0);
  END IF;

  v_total := array_length(p_numeros, 1) * v_rifa.custo_por_numero;

  IF (SELECT credits FROM perfis WHERE id = v_user_id) < v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits');
  END IF;

  FOR v_num IN SELECT unnest(p_numeros) LOOP
    UPDATE numeros_rifa
    SET status = 'vendido', comprador_id = v_user_id,
        vendedor_id = v_vendedor_id
    WHERE rifa_id = p_rifa_id AND numero = v_num AND status = 'disponivel';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'numero_indisponivel:%', v_num;
    END IF;
  END LOOP;

  UPDATE perfis SET credits = credits - v_total WHERE id = v_user_id;

  INSERT INTO compras_rifa (rifa_id, comprador_id, numeros, valor_total, tipo_pagamento, ref_vendedor_id)
  VALUES (p_rifa_id, v_user_id, p_numeros, v_total, 'creditos', v_vendedor_id)
  RETURNING id INTO v_compra_id;

  IF v_vendedor_id IS NOT NULL AND v_comissao > 0 THEN
    v_comissao_valor := v_total * (v_comissao / 100.0);
    UPDATE perfis SET credits = credits + v_comissao_valor
    WHERE id = (SELECT user_id FROM vendedores_rifa WHERE id = v_vendedor_id);
    
    PERFORM increment_admin_profit(-v_comissao_valor);
  END IF;

  INSERT INTO cartelas_rifa (numero_rifa_id, compra_id)
  SELECT nr.id, v_compra_id FROM numeros_rifa nr
  WHERE nr.rifa_id = p_rifa_id AND nr.numero = ANY(p_numeros);

  RETURN jsonb_build_object('success', true, 'compra_id', v_compra_id, 'total', v_total);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;