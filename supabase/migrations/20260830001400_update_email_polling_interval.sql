DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'fetch-incoming-emails-job'
  ) THEN
    PERFORM cron.unschedule('fetch-incoming-emails-job');
  END IF;
END $$;

SELECT cron.schedule(
  'fetch-incoming-emails-job',
  '45 seconds',
  'SELECT public.cron_fetch_incoming_emails();'
);