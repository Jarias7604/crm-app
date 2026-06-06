-- Aseguramos que pg_net y pg_cron existan
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Removemos los jobs anteriores de forma segura y condicional para evitar excepciones si no existen
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'agent-orchestrator-hourly';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'marketing-agent-orchestrator-cron';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sofia-call-dispatcher';

-- Agendamos el Orchestrator para que corra cada 3 minutos en el proyecto de producción real (mtxqq)
SELECT cron.schedule(
  'agent-orchestrator-hourly',
  '*/3 * * * *',
  $$
    SELECT net.http_post(
        url:='https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/agent-orchestrator',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Agendamos el Sofia Call Bot dispatcher para que corra cada 5 minutos en el proyecto de producción real (mtxqq)
SELECT cron.schedule(
  'sofia-call-dispatcher',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
        url:='https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/sofia-voice-bot',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{"action": "auto_dispatch"}'::jsonb
    ) as request_id;
  $$
);
