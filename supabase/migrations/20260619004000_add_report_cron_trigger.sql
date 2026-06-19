-- ============================================================
-- Cron Trigger: Auto-send scheduled performance reports
-- daily at 8:00 AM UTC via pg_cron + pg_net
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function: calls process-report-schedules edge function
-- Uses anon key — function is deployed with no-verify-jwt
CREATE OR REPLACE FUNCTION trigger_report_schedules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM net.http_post(
        url := 'https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/process-report-schedules',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eHFxYW1pdGdsaGVoYWt0Z3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTg3NDAsImV4cCI6MjA4NTQ5NDc0MH0.ybK2j-anHpMIlgaH0D-pRz4W6kyb96fNsbXTfT2FE2o'
        ),
        body := '{}'::jsonb
    );
    RAISE NOTICE '[cron] process-report-schedules triggered at %', NOW();
END;
$$;

-- Schedule: every day at 8:00 AM UTC
-- pg_cron format: minute hour day-of-month month day-of-week
SELECT cron.schedule(
    'send-performance-reports-daily',
    '0 8 * * *',
    'SELECT trigger_report_schedules()'
);
