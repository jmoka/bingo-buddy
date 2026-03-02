CREATE OR REPLACE FUNCTION cancelar_reserva_vendedor(p_numero_rifa_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_vendedor_id UUID;
  v_numero numeros_rifa%ROWTYPE;
  v_preco_unit NUMERIC;
  v_compra compras_rifa%ROWTYPE;
BEGIN
  SELECT id INTO v_vendedor_id FROM vendedores_rifa WHERE user_id = v_user_id AND ativo = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_vendor');
  END IF;

  SELECT * INTO v_numero FROM numeros_rifa
  WHERE id = p_numero_rifa_id AND vendedor_id = v_vendedor_id AND status = 'reservado';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'numero_not_found');
  END IF;

  -- Buscar o valor pago por este número na compra do vendedor
  SELECT * INTO v_compra FROM compras_rifa
  WHERE vendedor_id = v_vendedor_id
    AND rifa_id = v_numero.rifa_id
    AND v_numero.numero = ANY(numeros)
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_preco_unit := v_compra.valor_total / array_length(v_compra.numeros, 1);
  ELSE
    v_preco_unit := 0;
  END IF;

  -- Devolver número para disponível
  UPDATE numeros_rifa
  SET status = 'disponivel', vendedor_id = NULL
  WHERE id = p_numero_rifa_id;

  -- Estornar créditos ao vendedor
  IF v_preco_unit > 0 THEN
    UPDATE perfis SET credits = credits + v_preco_unit WHERE id = v_user_id;
  END IF;

  -- Remover cartela associada
  DELETE FROM cartelas_rifa WHERE numero_rifa_id = p_numero_rifa_id;

  -- Remover número do array da compra ou deletar compra se ficou vazia
  UPDATE compras_rifa
  SET numeros = array_remove(numeros, v_numero.numero),
      valor_total = GREATEST(0, valor_total - v_preco_unit)
  WHERE id = v_compra.id;

  DELETE FROM compras_rifa WHERE id = v_compra.id AND array_length(numeros, 1) = 0;

  RETURN jsonb_build_object('success', true, 'creditos_estornados', v_preco_unit);
END;
$$;
