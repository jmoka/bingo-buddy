-- Cron job para o motor de sorteio automático
-- Executa a cada minuto para chamar números em partidas ativas

-- Remove job anterior se existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-call-engine-job') THEN
        PERFORM cron.unschedule('auto-call-engine-job');
    END IF;
END $$;

-- Agenda execução a cada minuto (pg_cron não suporta segundos)
-- A edge function é idempotente: só chama se next_auto_call_timestamp já venceu
SELECT cron.schedule(
  'auto-call-engine-job',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://vqvnodwojefubbbnbyar.supabase.co/functions/v1/auto-call-engine',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdm5vZHdvamVmdWJiYm5ieWFyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMyOTM2OSwiZXhwIjoyMDg2OTA1MzY5fQ.J3dtfeiAkSttJwoSHLF0YqBjxXoTrxqvGOJUmJr973U"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);
