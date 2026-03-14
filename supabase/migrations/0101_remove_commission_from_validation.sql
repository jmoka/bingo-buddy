-- Arquivo de migração para remover os repasses da função de validação pública
-- pois estes devem ocorrer apenas na confirmação de pagamento (Webhook ou Manual).

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
BEGIN
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

    RETURN jsonb_build_object('success', true);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Código de validação não encontrado.');
END;
$function$;