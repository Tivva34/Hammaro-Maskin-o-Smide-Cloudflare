-- 1. Aktivera nödvändiga extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- 2. Skapa funktionen som triggar TEST webhooken
CREATE OR REPLACE FUNCTION public.cron_fetch_incoming_emails()
RETURNS void AS $$
DECLARE
  v_api_key text;
  v_request_id bigint;
BEGIN
  -- Hämta API-nyckeln från Vault
  SELECT secret INTO v_api_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'imap_test_api_key' 
  LIMIT 1;

  IF v_api_key IS NULL THEN
    RAISE LOG 'cron_fetch_incoming_emails: API-nyckel saknas i Vault.';
    RETURN;
  END IF;

  -- Gör POST-anropet via pg_net till TEST-funktionen
  v_request_id := net.http_post(
    url := 'https://xytxojulssevjxtphhls.supabase.co/functions/v1/fetch-incoming-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', regexp_replace(v_api_key, '[\r\n\t]', '', 'g')
    ),
    body := '{"dry_run":false}'::jsonb,
    timeout_milliseconds := 15000
  );

  RAISE LOG 'cron_fetch_incoming_emails: pg_net request skickat till kö. Request ID: %', v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, vault, pg_catalog;

-- 3. Idempotent schemaläggning (1 gång per minut)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-incoming-emails-job') THEN
    PERFORM cron.unschedule('fetch-incoming-emails-job');
  END IF;
END $$;

SELECT cron.schedule('fetch-incoming-emails-job', '* * * * *', 'SELECT public.cron_fetch_incoming_emails();');
