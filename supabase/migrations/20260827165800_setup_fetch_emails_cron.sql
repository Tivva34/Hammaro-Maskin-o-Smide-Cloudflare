-- 1. Aktivera nödvändiga extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- 2. Skapa den säkra databasfunktionen som wrappar HTTP-anropet
CREATE OR REPLACE FUNCTION public.cron_fetch_incoming_emails()
RETURNS void AS $$
DECLARE
  v_api_key text;
  v_request http_request;
  v_response http_response;
BEGIN
  -- A. Hämta API-nyckeln från Vault
  SELECT secret INTO v_api_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'imap_test_api_key' 
  LIMIT 1;

  IF v_api_key IS NULL THEN
    RAISE LOG 'cron_fetch_incoming_emails: API-nyckel saknas i Vault.';
    RETURN;
  END IF;

  -- B. Förhindra överlappande körningar med en transaktionsbunden advisory lock.
  -- hashtext('fetch_incoming_emails_lock') genererar ett unikt integer-ID.
  IF NOT pg_try_advisory_xact_lock(hashtext('fetch_incoming_emails_lock')) THEN
    RAISE LOG 'cron_fetch_incoming_emails: Föregående körning pågår fortfarande. Avbryter.';
    RETURN;
  END IF;

  -- C. Konfigurera en säker timeout för det synkrona anropet (15 sekunder)
  PERFORM http_set_curlopt('CURLOPT_TIMEOUT', '15');

  -- D. Bygg upp och skicka anropet
  v_request.method := 'POST';
  v_request.uri := 'https://cekydpwzxkrhvlkqnlji.supabase.co/functions/v1/fetch-incoming-emails';
  v_request.content_type := 'application/json';
  v_request.headers := ARRAY[http_header('apikey', v_api_key)];
  v_request.content := '{"dry_run":false}';

  v_response := http(v_request);

  -- E. Logga endast HTTP-status. Vi loggar ALDRIG request headers, v_api_key 
  -- eller v_response.content för att garantera att inga secrets läcker i loggarna.
  IF v_response.status >= 200 AND v_response.status < 300 THEN
    RAISE LOG 'cron_fetch_incoming_emails: Success (HTTP %)', v_response.status;
  ELSE
    RAISE LOG 'cron_fetch_incoming_emails: Failed (HTTP %)', v_response.status;
  END IF;
  
  -- När funktionen och dess transaktion avslutas släpps xact_lock automatiskt.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, vault, pg_catalog;

-- 3. Schemalägg cron-jobbet (varje minut)
-- Gör unschedule exception-säkert/idempotent genom att först kontrollera om jobbet existerar i cron.job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-incoming-emails-job') THEN
    PERFORM cron.unschedule('fetch-incoming-emails-job');
  END IF;
END $$;

SELECT cron.schedule('fetch-incoming-emails-job', '* * * * *', 'SELECT public.cron_fetch_incoming_emails();');
