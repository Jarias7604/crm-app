-- Fix daily performance reports pg_cron function:
-- 1) Remove disabled legacy anon JWT header that caused HTTP 401 ("Legacy API keys are disabled").
-- 2) Raise pg_net HTTP timeout to 25000ms so scheduled report dispatches complete cleanly.
CREATE OR REPLACE FUNCTION public.trigger_report_schedules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM net.http_post(
        url := 'https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/process-report-schedules',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
    );
    RAISE NOTICE '[cron] process-report-schedules triggered at %', NOW();
END;
$$;
