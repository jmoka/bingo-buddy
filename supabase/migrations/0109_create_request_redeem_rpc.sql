CREATE OR REPLACE FUNCTION request_redeem(p_credits NUMERIC, p_amount NUMERIC, p_message TEXT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_id UUID;
  v_current_credits NUMERIC;
  v_request_id UUID;
BEGIN
  v_player_id := auth.uid();
  IF v_player_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Trava a linha do perfil para evitar corrida (Race condition) ao descontar
  SELECT credits INTO v_current_credits FROM perfis WHERE id = v_player_id FOR UPDATE;
  
  IF v_current_credits < p_credits THEN
    RETURN json_build_object('success', false, 'error', 'insufficient_credits');
  END IF;

  -- Desconta os créditos do jogador
  UPDATE perfis SET credits = credits - p_credits WHERE id = v_player_id;

  -- Insere o pedido de resgate
  INSERT INTO solicitacoes_resgate (player_id, credits_requested, amount_to_receive, status)
  VALUES (v_player_id, p_credits, p_amount, 'pending')
  RETURNING id INTO v_request_id;

  -- Insere a mensagem com a chave PIX, se enviada
  IF p_message IS NOT NULL AND trim(p_message) <> '' THEN
    INSERT INTO mensagens_resgate (redeem_request_id, sender_id, message)
    VALUES (v_request_id, v_player_id, trim(p_message));
  END IF;

  RETURN json_build_object('success', true, 'request_id', v_request_id);
END;
$$;