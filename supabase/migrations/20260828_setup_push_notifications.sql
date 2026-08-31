-- =============================================================================
-- Migration: 20260828_setup_push_notifications.sql
-- Skapar push_subscriptions-tabell, lägger till general_inquiries,
-- och sätter upp DB-triggers som anropar Edge Function via pg_net.
-- =============================================================================

-- 1. Lägg till general_inquiries i user_notification_preferences
-- ---------------------------------------------------------------
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS general_inquiries boolean NOT NULL DEFAULT false;

-- Befintliga rader: general_inquiries = false (via DEFAULT ovan)
-- Nya rader via trigger create_preferences_on_user_profile_insert: DEFAULT gäller automatiskt.


-- 2. Skapa push_subscriptions-tabellen
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  endpoint      text        NOT NULL,
  p256dh        text        NOT NULL,
  auth          text        NOT NULL,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,

  -- En enhet kan bara ha en subscription per användare
  CONSTRAINT push_subscriptions_user_endpoint_key UNIQUE (user_id, endpoint)
);

-- Auto-uppdatera updated_at
CREATE OR REPLACE FUNCTION update_push_subscription_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_push_subscription_updated_at ON push_subscriptions;
CREATE TRIGGER set_push_subscription_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_push_subscription_updated_at();

-- Index för snabb lookup på user_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);


-- 3. RLS för push_subscriptions
-- ---------------------------------------------------------------
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Användare hanterar sina egna subscriptions (inkl. INSERT, UPDATE, DELETE)
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO service_role;


-- 4. Skapa push_notification_queue (för tillförlitlighet)
-- ---------------------------------------------------------------
-- Queue separerar DB-triggern (snabb, non-blocking) från Edge Function-anropet.
-- Fördelen: ett tillfälligt nätverksfel i pg_net raderar aldrig affärsdatan.
-- Edge Function-triggern anropar kön direkt via pg_net – kön är i sig redundansen.

CREATE TABLE IF NOT EXISTS push_notification_queue (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text        NOT NULL,  -- 'new_quote_request' | 'customer_reply'
  quote_request_id uuid,
  payload         jsonb       NOT NULL,
  attempts        integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz,
  last_error      text,

  -- Deduplicering: samma event kan inte köas två gånger
  CONSTRAINT push_notification_queue_dedup_key UNIQUE (event_type, quote_request_id)
);

-- Index för att snabbt hitta oprocessade jobb
CREATE INDEX IF NOT EXISTS idx_push_queue_processed ON push_notification_queue(processed_at)
  WHERE processed_at IS NULL;

-- RLS: Tabellen används bara server-side av triggers och Edge Functions.
-- Vanliga users ska aldrig komma åt den.
ALTER TABLE push_notification_queue ENABLE ROW LEVEL SECURITY;
-- Ingen publik policy = ingen åtkomst alls via Supabase client (service_role kringgår RLS)


-- 5. Hjälpfunktion: koa ett push-event (anropas av triggers)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_push_notification(
  p_event_type      text,
  p_quote_request_id uuid,
  p_payload         jsonb
)
RETURNS void AS $$
DECLARE
  v_trigger_secret text;
  v_request_id     bigint;
BEGIN
  -- Koa eventet (upsert för idempotens – om trigger körs igen ändras inget)
  INSERT INTO push_notification_queue (event_type, quote_request_id, payload)
  VALUES (p_event_type, p_quote_request_id, p_payload)
  ON CONFLICT (event_type, quote_request_id) DO NOTHING;

  -- Hämta trigger-secret från Vault
  SELECT decrypted_secret INTO v_trigger_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_trigger_secret'
  LIMIT 1;

  IF v_trigger_secret IS NULL THEN
    RAISE LOG 'enqueue_push_notification: push_trigger_secret saknas i Vault. Push skickas ej.';
    RETURN;
  END IF;

  -- Anropa Edge Function asynkront via pg_net
  v_request_id := net.http_post(
    url    := 'https://cekydpwzxkrhvlkqnlji.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-trigger-secret', regexp_replace(v_trigger_secret, '[\r\n\t]', '', 'g')
    ),
    body   := p_payload,
    timeout_milliseconds := 10000
  );

  RAISE LOG 'enqueue_push_notification: pg_net request ID % för event %', v_request_id, p_event_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, vault, pg_catalog;


-- 6. Trigger: Ny offertförfrågan → push-event
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_push_on_new_quote_request()
RETURNS trigger AS $$
DECLARE
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'event',            'new_quote_request',
    'quote_request_id', NEW.id::text,
    'request_type',     NEW.request_type,
    'customer_name',    NEW.name
  );

  -- Asynkront och non-blocking – fel påverkar ALDRIG INSERT av quote_request
  BEGIN
    PERFORM public.enqueue_push_notification('new_quote_request', NEW.id, v_payload);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'trigger_push_on_new_quote_request: fel vid köning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_quote_request_push ON quote_requests;
CREATE TRIGGER on_quote_request_push
  AFTER INSERT ON quote_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_push_on_new_quote_request();


-- 7. Trigger: Kundmeddelande → push-event
-- ---------------------------------------------------------------
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
      SELECT secret INTO v_trigger_secret
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

DROP TRIGGER IF EXISTS on_quote_message_push ON quote_messages;
CREATE TRIGGER on_quote_message_push
  AFTER INSERT ON quote_messages
  FOR EACH ROW EXECUTE FUNCTION trigger_push_on_customer_reply();
