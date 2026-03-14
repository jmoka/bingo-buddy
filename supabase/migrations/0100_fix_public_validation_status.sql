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

    -- Paga a comissão
    IF v_venda_bingo.vendedor_id IS NOT NULL THEN
      SELECT * INTO v_vendedor FROM vendedores_rifa WHERE id = v_venda_bingo.vendedor_id;
      
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

    -- Atualiza os dados no numero da rifa e passa para VENDIDO
    UPDATE numeros_rifa 
    SET nome_comprador = p_nome, 
        telefone_comprador = p_telefone, 
        endereco_comprador = p_endereco,
        status = 'vendido'
    WHERE id = v_cartela_rifa.numero_id;

    -- Verifica se já foi paga a comissão desta compra
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