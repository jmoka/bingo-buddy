ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS live_external_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_external_provider TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS live_external_rtmp_url TEXT,
  ADD COLUMN IF NOT EXISTS live_external_stream_key TEXT,
  ADD COLUMN IF NOT EXISTS live_external_youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS live_external_facebook_url TEXT;

CREATE OR REPLACE FUNCTION public.update_live_stream_settings(p_settings JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Garante linha de configuração para o admin atual
  IF NOT EXISTS (SELECT 1 FROM public.configuracoes WHERE admin_id = auth.uid()) THEN
    INSERT INTO public.configuracoes (admin_id, singleton)
    VALUES (auth.uid(), false);
  END IF;

  UPDATE public.configuracoes SET
    live_external_enabled      = CASE WHEN p_settings ? 'live_external_enabled' THEN (p_settings->>'live_external_enabled')::BOOLEAN ELSE live_external_enabled END,
    live_external_provider     = CASE WHEN p_settings ? 'live_external_provider' THEN COALESCE(p_settings->>'live_external_provider', live_external_provider) ELSE live_external_provider END,
    live_external_rtmp_url     = CASE WHEN p_settings ? 'live_external_rtmp_url' THEN COALESCE(p_settings->>'live_external_rtmp_url', live_external_rtmp_url) ELSE live_external_rtmp_url END,
    live_external_stream_key   = CASE WHEN p_settings ? 'live_external_stream_key' THEN COALESCE(p_settings->>'live_external_stream_key', live_external_stream_key) ELSE live_external_stream_key END,
    live_external_youtube_url  = CASE WHEN p_settings ? 'live_external_youtube_url' THEN COALESCE(p_settings->>'live_external_youtube_url', live_external_youtube_url) ELSE live_external_youtube_url END,
    live_external_facebook_url = CASE WHEN p_settings ? 'live_external_facebook_url' THEN COALESCE(p_settings->>'live_external_facebook_url', live_external_facebook_url) ELSE live_external_facebook_url END
  WHERE admin_id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$$;

NOTIFY pgrst, 'reload schema';
