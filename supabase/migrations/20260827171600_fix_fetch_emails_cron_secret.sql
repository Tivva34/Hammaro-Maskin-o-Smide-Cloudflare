-- Ersätt funktionen med en version som tvättar Vault-secreten från inbäddade radbrytningar
CREATE OR REPLACE FUNCTION public.cron_fetch_incoming_emails()
RETURNS void AS $$
DECLARE
  v_api_key text;
  v_request_id bigint;
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

  -- B. pg_net sköter utgående anrop asynkront.
  -- Nyckeln tvättas med regexp_replace för att säkerställa att inga ogiltiga
  -- tecken (som \r, \n, \t) kraschar libcurl-headern.
  v_request_id := net.http_post(
    url := 'https://cekydpwzxkrhvlkqnlji.supabase.co/functions/v1/fetch-incoming-emails',
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
