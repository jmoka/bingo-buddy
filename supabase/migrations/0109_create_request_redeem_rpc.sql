CREATE OR REPLACE FUNCTION request_redeem(p_credits NUMERIC, p_amount NUMERIC, p_message TEXT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_id UUID;
  v_current_credits NUMERIC;
  v_admin_id UUID;
  v_request_id UUID;
BEGIN
  -- SEGURANÇA: Validação de Entrada
  IF p_credits <= 0 OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_amount_or_credits');
  END IF;

  v_player_id := auth.uid();
  IF v_player_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Busca de dados e bloqueio de linha (Race Condition Prevention)
  SELECT credits, admins_id INTO v_current_credits, v_admin_id 
  FROM perfis 
  WHERE id = v_player_id FOR UPDATE;
  
  IF v_current_credits < p_credits THEN
    RETURN json_build_object('success', false, 'error', 'insufficient_credits');
  END IF;

  -- Débito atômico do jogador
  UPDATE perfis SET credits = credits - p_credits WHERE id = v_player_id;

  -- Inserção na tabela principal (Corrigido para admin_id)
  INSERT INTO solicitacoes_resgate (player_id, credits_requested, amount_to_receive, status, admin_id)
  VALUES (v_player_id, p_credits, p_amount, 'pending', v_admin_id)
  RETURNING id INTO v_request_id;

  -- Inserção da mensagem inicial (Corrigido para admin_id)
  IF p_message IS NOT NULL AND trim(p_message) <> '' THEN
    INSERT INTO mensagens_resgate (redeem_request_id, sender_id, message, admin_id)
    VALUES (v_request_id, v_player_id, trim(p_message), v_admin_id);
  END IF;

  RETURN json_build_object('success', true, 'request_id', v_request_id);
END;
$$;