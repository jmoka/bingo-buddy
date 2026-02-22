-- Habilita as extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Bloco anônimo para remover o job apenas se ele existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-match-engine-job') THEN
        PERFORM cron.unschedule('auto-match-engine-job');
    END IF;
END $$;

-- Agenda a execução da função auto-match-engine a cada 10 minutos
-- O motor verificará internamente se já passou o intervalo de 60 minutos configurado por você
SELECT cron.schedule(
  'auto-match-engine-job',
  '*/10 * * * *', -- A cada 10 minutos
  $$
  SELECT
    net.http_post(
      url:='https://vqvnodwojefubbbnbyar.supabase.co/functions/v1/auto-match-engine',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdm5vZHdvamVmdWJiYm5ieWFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMyOTM2OSwiZXhwIjoyMDg2OTA1MzY5fQ.6_v_v_v_v_v_v_v_v_v_v_v_v_v_v_v_v_v_v_v_v_v_v"}'::jsonb
    ) as request_id;
  $$
);