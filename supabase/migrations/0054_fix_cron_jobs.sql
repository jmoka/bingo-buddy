-- Remove jobs antigos se existirem
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-match-engine-job') THEN
        PERFORM cron.unschedule('auto-match-engine-job');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-call-engine-job') THEN
        PERFORM cron.unschedule('auto-call-engine-job');
    END IF;
END $$;

-- Reagenda auto-match-engine a cada 10 minutos
SELECT cron.schedule(
  'auto-match-engine-job',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://vqvnodwojefubbbnbyar.supabase.co/functions/v1/auto-match-engine',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdm5vZHdvamVmdWJiYm5ieWFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMyOTM2OSwiZXhwIjoyMDg2OTA1MzY5fQ.J3dtfeiAkSttJwoSHLF0YqBjxXoTrxqvGOJUmJr973U"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Reagenda auto-call-engine a cada minuto
SELECT cron.schedule(
  'auto-call-engine-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://vqvnodwojefubbbnbyar.supabase.co/functions/v1/auto-call-engine',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdm5vZHdvamVmdWJiYm5ieWFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMyOTM2OSwiZXhwIjoyMDg2OTA1MzY5fQ.J3dtfeiAkSttJwoSHLF0YqBjxXoTrxqvGOJUmJr973U"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Verifica os jobs registrados
SELECT jobname, schedule, active FROM cron.job WHERE jobname IN ('auto-match-engine-job', 'auto-call-engine-job');
