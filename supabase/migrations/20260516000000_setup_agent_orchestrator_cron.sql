-- Aseguramos que las extensiones existan (Supabase las incluye, pero hay que activarlas)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Removemos el job si ya existe para evitar duplicados en re-deploys
SELECT cron.unschedule('agent-orchestrator-hourly');

-- Agendamos el Orchestrator para que corra cada hora (en el minuto 0)
-- Llama a la Edge Function global que procesará TODAS las empresas activas
SELECT cron.schedule(
  'agent-orchestrator-hourly',
  '0 * * * *',
  $$
    SELECT net.http_post(
        url:='https://ikofyypxphrqkncimszt.supabase.co/functions/v1/agent-orchestrator',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
