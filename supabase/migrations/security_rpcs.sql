-- ============================================================
-- TAREFA 1: RPC buy_card_uses
-- ============================================================
CREATE OR REPLACE FUNCTION buy_card_uses(p_player_card_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_card         cartelas_jogador%ROWTYPE;
  v_settings     configuracoes%ROWTYPE;
  v_profile      perfis%ROWTYPE;
  v_cost         NUMERIC;
  v_is_fake      BOOLEAN;
BEGIN
  SELECT * INTO v_card
  FROM cartelas_jogador
  WHERE id = p_player_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'card_not_found');
  END IF;

  IF v_card.player_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_settings FROM configuracoes LIMIT 1;
  v_cost := v_settings.custo_recarga_cartela;

  v_is_fake := (v_card.credit_type = 'fake');

  SELECT * INTO v_profile
  FROM perfis
  WHERE id = v_card.player_id
  FOR UPDATE;

  IF v_is_fake THEN
    IF (COALESCE(v_profile.fake_credits, 0) < v_cost) THEN
      RETURN jsonb_build_object('success', false, 'error', 'insufficient_fake_credits');
    END IF;
    UPDATE perfis
    SET fake_credits = fake_credits - v_cost
    WHERE id = v_card.player_id;
  ELSE
    IF v_cost > 0 AND (v_profile.credits < v_cost) THEN
      RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits');
    END IF;
    IF v_cost > 0 THEN
      UPDATE perfis
      SET credits = credits - v_cost
      WHERE id = v_card.player_id;
    END IF;
  END IF;

  UPDATE cartelas_jogador
  SET uses_left = uses_left + v_settings.usos_por_recarga
  WHERE id = p_player_card_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================================
-- TAREFA 2: RPCs admin_adjust_credits e admin_adjust_fake_credits
-- ============================================================
CREATE OR REPLACE FUNCTION admin_adjust_credits(p_player_id UUID, p_delta NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM perfis WHERE id = auth.uid();
  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE perfis
  SET credits = credits + p_delta
  WHERE id = p_player_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION admin_adjust_fake_credits(p_player_id UUID, p_delta NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM perfis WHERE id = auth.uid();
  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE perfis
  SET fake_credits = COALESCE(fake_credits, 0) + p_delta
  WHERE id = p_player_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================================
-- TAREFA 3: RPC process_redeem_request
-- ============================================================
CREATE OR REPLACE FUNCTION process_redeem_request(
  p_player_id UUID,
  p_credits   NUMERIC,
  p_amount    NUMERIC,
  p_message   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile    perfis%ROWTYPE;
  v_request_id UUID;
BEGIN
  SELECT * INTO v_profile FROM perfis WHERE id = p_player_id FOR UPDATE;

  IF v_profile.credits < p_credits THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits');
  END IF;

  UPDATE perfis SET credits = credits - p_credits WHERE id = p_player_id;

  INSERT INTO solicitacoes_resgate (player_id, credits_requested, amount_to_receive, status)
  VALUES (p_player_id, p_credits, p_amount, 'pending')
  RETURNING id INTO v_request_id;

  IF p_message IS NOT NULL THEN
    INSERT INTO mensagens_resgate (redeem_request_id, sender_id, message)
    VALUES (v_request_id, p_player_id, p_message);
  END IF;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;


-- ============================================================
-- TAREFA 5: RPC update_game_settings
-- ============================================================
CREATE OR REPLACE FUNCTION update_game_settings(p_settings JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM perfis WHERE id = auth.uid();
  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF (p_settings ? 'intervalo_sorteio_auto_seg') AND (p_settings->>'intervalo_sorteio_auto_seg')::NUMERIC < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'call_interval_too_low');
  END IF;

  UPDATE configuracoes SET
    custo_nova_cartela             = COALESCE((p_settings->>'custo_nova_cartela')::NUMERIC,          custo_nova_cartela),
    custo_recarga_cartela          = COALESCE((p_settings->>'custo_recarga_cartela')::NUMERIC,       custo_recarga_cartela),
    usos_por_recarga               = COALESCE((p_settings->>'usos_por_recarga')::INTEGER,            usos_por_recarga),
    intervalo_sorteio_auto_seg     = COALESCE((p_settings->>'intervalo_sorteio_auto_seg')::NUMERIC,  intervalo_sorteio_auto_seg),
    valor_por_credito              = COALESCE((p_settings->>'valor_por_credito')::NUMERIC,           valor_por_credito),
    pix_key                        = COALESCE(p_settings->>'pix_key',                                pix_key),
    credit_request_text            = COALESCE(p_settings->>'credit_request_text',                   credit_request_text),
    n8n_test_url                   = COALESCE(p_settings->>'n8n_test_url',                           n8n_test_url),
    n8n_prod_url                   = COALESCE(p_settings->>'n8n_prod_url',                           n8n_prod_url),
    n8n_env                        = COALESCE(p_settings->>'n8n_env',                                n8n_env),
    auto_engine_enabled            = COALESCE((p_settings->>'auto_engine_enabled')::BOOLEAN,         auto_engine_enabled),
    auto_engine_interval_mins      = COALESCE((p_settings->>'auto_engine_interval_mins')::NUMERIC,   auto_engine_interval_mins),
    auto_engine_matches_per_day    = COALESCE((p_settings->>'auto_engine_matches_per_day')::INTEGER, auto_engine_matches_per_day),
    auto_engine_game_type          = COALESCE(p_settings->>'auto_engine_game_type',                  auto_engine_game_type),
    auto_engine_card_price         = COALESCE((p_settings->>'auto_engine_card_price')::NUMERIC,      auto_engine_card_price),
    auto_engine_prize_type         = COALESCE(p_settings->>'auto_engine_prize_type',                 auto_engine_prize_type),
    auto_engine_prize_value        = COALESCE((p_settings->>'auto_engine_prize_value')::NUMERIC,     auto_engine_prize_value),
    auto_engine_start_hour         = COALESCE((p_settings->>'auto_engine_start_hour')::INTEGER,      auto_engine_start_hour)
  WHERE singleton = true;

  RETURN jsonb_build_object('success', true);
END;
$$;
