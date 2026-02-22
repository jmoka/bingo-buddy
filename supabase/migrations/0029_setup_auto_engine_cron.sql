-- Habilita a extensão pg_cron se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove o job se já existir para evitar duplicatas
SELECT cron.unschedule('auto-match-engine-job');

-- Agenda a execução da função auto-match-engine a cada 10 minutos
-- Nota: Substitua 'https://vqvnodwojefubbbnbyar.supabase.co' pela URL do seu projeto se necessário, 
-- mas o padrão do Supabase já resolve internamente.
SELECT cron.schedule(
  'auto-match-engine-job',
  '*/10 * * * *', -- A cada 10 minutos
  $$
  SELECT
    net.http_post(
      url:='https://vqvnodwojefubbbnbyar.supabase.co/functions/v1/auto-match-engine',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb
    ) as request_id;
  $$
);