-- Adiciona as colunas de transmissão externa se não existirem
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS live_external_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS live_external_provider TEXT DEFAULT 'manual';
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS live_external_rtmp_url TEXT DEFAULT '';
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS live_external_stream_key TEXT DEFAULT '';
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS live_external_youtube_url TEXT DEFAULT '';
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS live_external_facebook_url TEXT DEFAULT '';

-- Atualiza a função RPC para incluir os novos campos de transmissão
CREATE OR REPLACE FUNCTION public.update_game_settings(p_settings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM perfis WHERE id = auth.uid();
  IF v_caller_role NOT IN ('admin', 'dev') THEN
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
    pix_name                       = COALESCE(p_settings->>'pix_name',                               pix_name),
    pix_city                       = COALESCE(p_settings->>'pix_city',                               pix_city),
    credit_request_text            = COALESCE(p_settings->>'credit_request_text',                   credit_request_text),
    n8n_test_url                   = COALESCE(p_settings->>'n8n_test_url',                           n8n_test_url),
    n8n_prod_url                   = COALESCE(p_settings->>'n8n_prod_url',                           n8n_prod_url),
    n8n_env                        = COALESCE(p_settings->>'n8n_env',                                n8n_env),
    auto_engine_enabled            = COALESCE((p_settings->>'auto_engine_enabled')::BOOLEAN,         auto_engine_enabled),
    auto_engine_interval_mins      = COALESCE((p_settings->>'auto_engine_interval_mins')::INTEGER,   auto_engine_interval_mins),
    auto_engine_matches_per_day    = COALESCE((p_settings->>'auto_engine_matches_per_day')::INTEGER, auto_engine_matches_per_day),
    auto_engine_game_type          = COALESCE(p_settings->>'auto_engine_game_type',                  auto_engine_game_type),
    auto_engine_card_price         = COALESCE((p_settings->>'auto_engine_card_price')::NUMERIC,      auto_engine_card_price),
    auto_engine_prize_type         = COALESCE(p_settings->>'auto_engine_prize_type',                 auto_engine_prize_type),
    auto_engine_prize_value        = COALESCE((p_settings->>'auto_engine_prize_value')::NUMERIC,     auto_engine_prize_value),
    auto_engine_start_hour         = COALESCE((p_settings->>'auto_engine_start_hour')::INTEGER,      auto_engine_start_hour),
    auto_engine_max_cards          = COALESCE((p_settings->>'auto_engine_max_cards')::INTEGER,       auto_engine_max_cards),
    desconto_vendedor_global       = COALESCE((p_settings->>'desconto_vendedor_global')::NUMERIC,    desconto_vendedor_global),
    comissao_vendedor_global       = COALESCE((p_settings->>'comissao_vendedor_global')::NUMERIC,    comissao_vendedor_global),
    cartelas_por_folha_bingo       = COALESCE((p_settings->>'cartelas_por_folha_bingo')::INTEGER,    cartelas_por_folha_bingo),
    stripe_enabled                 = COALESCE((p_settings->>'stripe_enabled')::BOOLEAN,              stripe_enabled),
    stripe_env                     = COALESCE(p_settings->>'stripe_env',                             stripe_env),
    stripe_secret_key              = COALESCE(p_settings->>'stripe_secret_key',                      stripe_secret_key),
    stripe_secret_key_test         = COALESCE(p_settings->>'stripe_secret_key_test',                 stripe_secret_key_test),
    stripe_webhook_secret          = COALESCE(p_settings->>'stripe_webhook_secret',                  stripe_webhook_secret),
    stripe_webhook_secret_test     = COALESCE(p_settings->>'stripe_webhook_secret_test',             stripe_webhook_secret_test),
    stripe_pass_fees_to_customer   = COALESCE((p_settings->>'stripe_pass_fees_to_customer')::BOOLEAN, stripe_pass_fees_to_customer),
    stripe_fee_percentage          = COALESCE((p_settings->>'stripe_fee_percentage')::NUMERIC,       stripe_fee_percentage),
    stripe_fee_fixed               = COALESCE((p_settings->>'stripe_fee_fixed')::NUMERIC,            stripe_fee_fixed),
    pagbank_enabled                = COALESCE((p_settings->>'pagbank_enabled')::BOOLEAN,             pagbank_enabled),
    pagbank_env                    = COALESCE(p_settings->>'pagbank_env',                            pagbank_env),
    pagbank_token_sandbox          = COALESCE(p_settings->>'pagbank_token_sandbox',                  pagbank_token_sandbox),
    pagbank_token_producao         = COALESCE(p_settings->>'pagbank_token_producao',                 pagbank_token_producao),
    pagbank_pass_fees_to_customer  = COALESCE((p_settings->>'pagbank_pass_fees_to_customer')::BOOLEAN, pagbank_pass_fees_to_customer),
    pagbank_pix_fee_fixed          = COALESCE((p_settings->>'pagbank_pix_fee_fixed')::NUMERIC,       pagbank_pix_fee_fixed),
    pagbank_pix_fee_percentage     = COALESCE((p_settings->>'pagbank_pix_fee_percentage')::NUMERIC,  pagbank_pix_fee_percentage),
    pagbank_card_fee_fixed         = COALESCE((p_settings->>'pagbank_card_fee_fixed')::NUMERIC,      pagbank_card_fee_fixed),
    pagbank_card_fee_percentage    = COALESCE((p_settings->>'pagbank_card_fee_percentage')::NUMERIC, pagbank_card_fee_percentage),
    live_external_enabled          = COALESCE((p_settings->>'live_external_enabled')::BOOLEAN,       live_external_enabled),
    live_external_provider         = COALESCE(p_settings->>'live_external_provider',                 live_external_provider),
    live_external_rtmp_url         = COALESCE(p_settings->>'live_external_rtmp_url',                 live_external_rtmp_url),
    live_external_stream_key       = COALESCE(p_settings->>'live_external_stream_key',               live_external_stream_key),
    live_external_youtube_url      = COALESCE(p_settings->>'live_external_youtube_url',              live_external_youtube_url),
    live_external_facebook_url     = COALESCE(p_settings->>'live_external_facebook_url',             live_external_facebook_url)
  WHERE singleton = true;

  RETURN jsonb_build_object('success', true);
END;
$function$;
