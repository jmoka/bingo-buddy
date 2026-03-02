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
    auto_engine_start_hour         = COALESCE((p_settings->>'auto_engine_start_hour')::INTEGER,      auto_engine_start_hour),
    desconto_vendedor_global       = COALESCE((p_settings->>'desconto_vendedor_global')::NUMERIC,    desconto_vendedor_global),
    comissao_vendedor_global       = COALESCE((p_settings->>'comissao_vendedor_global')::NUMERIC,    comissao_vendedor_global)
  WHERE singleton = true;

  RETURN jsonb_build_object('success', true);
END;
$$;
