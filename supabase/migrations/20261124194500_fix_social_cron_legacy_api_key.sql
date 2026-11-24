-- Fix 5-minute social auto-publisher pg_cron function:
-- 1) Remove disabled legacy anon JWT header that caused HTTP 401 ("Legacy API keys are disabled").
-- 2) Raise pg_net HTTP timeout to 25000ms (from default 5000ms) so multi-platform publishes complete cleanly.
CREATE OR REPLACE FUNCTION public.trigger_scheduled_social_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM net.http_post(
        url := 'https://mtxqqamitglhehaktgxm.supabase.co/functions/v1/arias-social-bridge',
        headers := jsonb_build_object(
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('action', 'process_due_scheduled'),
        timeout_milliseconds := 25000
    );
END;
$$;
