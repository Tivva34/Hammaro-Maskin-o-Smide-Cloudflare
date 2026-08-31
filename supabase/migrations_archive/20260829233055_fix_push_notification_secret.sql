-- -----------------------------------------------------------------------------------------
-- FIX: Använd decrypted_secret istället för secret vid hämtning från vault.decrypted_secrets
-- -----------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_push_on_customer_reply()
RETURNS trigger AS $$
DECLARE
  v_payload jsonb;
BEGIN
  -- Endast kundmeddelanden – admin- och systemmeddelanden ska inte generera push
  IF NEW.sender_type != 'customer' THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'event',            'customer_reply',
    'quote_request_id', NEW.quote_request_id::text,
    'sender_email',     COALESCE(NEW.sender_email, ''),
    'message_id',       NEW.id::text
  );

  -- Unik nyckel för deduplicering: event_type + message_id (ej quote_request_id,
  -- eftersom flera kundsvar kan finnas per quote_request)
  -- Vi väljer att loopa per meddelande, alltså överskriver constraint-nyckeln.
  BEGIN
    -- Koa med message_id som del av deduplication-nyckel via payload
    INSERT INTO push_notification_queue (event_type, quote_request_id, payload)
    VALUES ('customer_reply', NEW.id, v_payload)
    ON CONFLICT (event_type, quote_request_id) DO NOTHING;

    DECLARE
      v_trigger_secret text;
      v_request_id     bigint;
    BEGIN
      -- HÄR VAR BUGGEN: Hämta decrypted_secret istället för den krypterade secret
      SELECT decrypted_secret INTO v_trigger_secret
      FROM vault.decrypted_secrets
      WHERE name = 'push_trigger_secret'
      LIMIT 1;

      IF v_trigger_secret IS NOT NULL THEN
        v_request_id := net.http_post(
          url    := 'https://cekydpwzxkrhvlkqnlji.supabase.co/functions/v1/send-push-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-trigger-secret', regexp_replace(v_trigger_secret, '[\r\n\t]', '', 'g')
          ),
          body   := v_payload,
          timeout_milliseconds := 10000
        );
        RAISE LOG 'trigger_push_on_customer_reply: pg_net request ID % för message %', v_request_id, NEW.id;
      ELSE
        RAISE LOG 'trigger_push_on_customer_reply: push_trigger_secret saknas i Vault.';
      END IF;
    END;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'trigger_push_on_customer_reply: fel vid köning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, vault, pg_catalog;
