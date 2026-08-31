


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."create_default_notification_preferences"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO user_notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_notification_preferences"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cron_fetch_incoming_emails"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net', 'vault', 'pg_catalog'
    AS $$
DECLARE
  v_api_key text;
  v_request_id bigint;
BEGIN
  -- A. HÃ¤mta API-nyckeln frÃ¥n Vault
  SELECT secret INTO v_api_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'imap_test_api_key' 
  LIMIT 1;

  IF v_api_key IS NULL THEN
    RAISE LOG 'cron_fetch_incoming_emails: API-nyckel saknas i Vault.';
    RETURN;
  END IF;

  -- B. pg_net skÃ¶ter utgÃ¥ende anrop asynkront.
  -- Nyckeln tvÃ¤ttas med regexp_replace fÃ¶r att sÃ¤kerstÃ¤lla att inga ogiltiga
  -- tecken (som \r, \n, \t) kraschar libcurl-headern.
  v_request_id := net.http_post(
    url := 'https://xytxojulssevjxtphhls.supabase.co/functions/v1/fetch-incoming-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', regexp_replace(v_api_key, '[\r\n\t]', '', 'g')
    ),
    body := '{"dry_run":false}'::jsonb,
    timeout_milliseconds := 120000
  );

  RAISE LOG 'cron_fetch_incoming_emails: pg_net request skickat till kÃ¶. Request ID: %', v_request_id;
END;
$$;


ALTER FUNCTION "public"."cron_fetch_incoming_emails"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_single_primary_image"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE machine_images
    SET    is_primary = false
    WHERE  machine_id = NEW.machine_id
      AND  id         <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_single_primary_image"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_push_notification"("p_event_type" "text", "p_quote_request_id" "uuid", "p_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net', 'vault', 'pg_catalog'
    AS $$
DECLARE
  v_trigger_secret text;
  v_request_id     bigint;
BEGIN
  -- Koa eventet (upsert f??r idempotens ??? om trigger k??rs igen ??ndras inget)
  INSERT INTO push_notification_queue (event_type, quote_request_id, payload)
  VALUES (p_event_type, p_quote_request_id, p_payload)
  ON CONFLICT (event_type, quote_request_id) DO NOTHING;

  -- H??mta trigger-secret fr??n Vault
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
    url    := 'https://xytxojulssevjxtphhls.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-trigger-secret', regexp_replace(v_trigger_secret, '[\r\n\t]', '', 'g')
    ),
    body   := p_payload,
    timeout_milliseconds := 10000
  );

  RAISE LOG 'enqueue_push_notification: pg_net request ID % f??r event %', v_request_id, p_event_type;
END;
$$;


ALTER FUNCTION "public"."enqueue_push_notification"("p_event_type" "text", "p_quote_request_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  u_role text;
BEGIN
  SELECT role INTO u_role FROM public.user_profiles WHERE id = auth.uid() AND is_active = true;
  RETURN u_role;
END;
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'admin')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("required_permission" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  u_permissions text[];
BEGIN
  SELECT permissions INTO u_permissions FROM public.user_profiles WHERE id = auth.uid() AND is_active = true;
  RETURN required_permission = ANY(u_permissions);
END;
$$;


ALTER FUNCTION "public"."has_permission"("required_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("required_role" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN public.get_user_role() = required_role;
END;
$$;


ALTER FUNCTION "public"."has_role"("required_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN has_role('superadmin') OR has_role('admin');
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_last_superadmin_removal"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    superadmin_count int;
BEGIN
    -- Only check if a superadmin is being removed, demoted, or deactivated
    IF (TG_OP = 'DELETE' AND OLD.role = 'superadmin' AND OLD.is_active = true) OR
       (TG_OP = 'UPDATE' AND OLD.role = 'superadmin' AND OLD.is_active = true AND (NEW.role != 'superadmin' OR NEW.is_active = false)) THEN
        
        -- Count remaining active superadmins (excluding the one being modified)
        SELECT COUNT(*) INTO superadmin_count
        FROM public.user_profiles
        WHERE role = 'superadmin' AND is_active = true AND id != OLD.id;
        
        IF superadmin_count = 0 THEN
            RAISE EXCEPTION 'SÃ¤kerhetsspÃ¤rr: Kan inte radera, inaktivera eller degradera den sista aktiva Superadmin-anvÃ¤ndaren.';
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_last_superadmin_removal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_push_on_customer_reply"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net', 'vault', 'pg_catalog'
    AS $$
DECLARE
  v_payload jsonb;
BEGIN
  -- Endast kundmeddelanden â€“ admin- och systemmeddelanden ska inte generera push
  IF NEW.sender_type != 'customer' THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'event',            'customer_reply',
    'quote_request_id', NEW.quote_request_id::text,
    'sender_email',     COALESCE(NEW.sender_email, ''),
    'message_id',       NEW.id::text
  );

  -- Unik nyckel fÃ¶r deduplicering: event_type + message_id (ej quote_request_id,
  -- eftersom flera kundsvar kan finnas per quote_request)
  -- Vi vÃ¤ljer att loopa per meddelande, alltsÃ¥ Ã¶verskriver constraint-nyckeln.
  BEGIN
    -- Koa med message_id som del av deduplication-nyckel via payload
    INSERT INTO push_notification_queue (event_type, quote_request_id, payload)
    VALUES ('customer_reply', NEW.id, v_payload)
    ON CONFLICT (event_type, quote_request_id) DO NOTHING;

    DECLARE
      v_trigger_secret text;
      v_request_id     bigint;
    BEGIN
      -- HÃ„R VAR BUGGEN: HÃ¤mta decrypted_secret istÃ¤llet fÃ¶r den krypterade secret
      SELECT decrypted_secret INTO v_trigger_secret
      FROM vault.decrypted_secrets
      WHERE name = 'push_trigger_secret'
      LIMIT 1;

      IF v_trigger_secret IS NOT NULL THEN
        v_request_id := net.http_post(
          url    := 'https://xytxojulssevjxtphhls.supabase.co/functions/v1/send-push-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-push-trigger-secret', regexp_replace(v_trigger_secret, '[\r\n\t]', '', 'g')
          ),
          body   := v_payload,
          timeout_milliseconds := 10000
        );
        RAISE LOG 'trigger_push_on_customer_reply: pg_net request ID % fÃ¶r message %', v_request_id, NEW.id;
      ELSE
        RAISE LOG 'trigger_push_on_customer_reply: push_trigger_secret saknas i Vault.';
      END IF;
    END;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'trigger_push_on_customer_reply: fel vid kÃ¶ning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_push_on_customer_reply"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_push_on_new_quote_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'event',            'new_quote_request',
    'quote_request_id', NEW.id::text,
    'request_type',     NEW.request_type,
    'customer_name',    NEW.name
  );

  -- Asynkront och non-blocking â€“ fel pÃ¥verkar ALDRIG INSERT av quote_request
  BEGIN
    PERFORM public.enqueue_push_notification('new_quote_request', NEW.id, v_payload);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'trigger_push_on_new_quote_request: fel vid kÃ¶ning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_push_on_new_quote_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_inventory_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_inventory_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_own_profile"("p_first_name" "text", "p_last_name" "text", "p_name" "text", "p_phone" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.user_profiles
  SET 
    first_name = p_first_name,
    last_name = p_last_name,
    name = p_name,
    phone = p_phone,
    updated_at = now()
  WHERE id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."update_own_profile"("p_first_name" "text", "p_last_name" "text", "p_name" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_push_subscription_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_push_subscription_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sales_records_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_sales_records_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admins" (
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "alt_text" "text",
    "is_primary" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" integer,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "name_en" "text",
    "description_en" "text",
    "slug" "text",
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    CONSTRAINT "inventory_category_check" CHECK (("category" = ANY (ARRAY['agriculture'::"text", 'construction'::"text", 'workshop'::"text", 'tires'::"text", 'parts'::"text", 'other'::"text"]))),
    CONSTRAINT "inventory_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'reserved'::"text", 'sold'::"text"])))
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."machine_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "machine_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "alt_text" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "machine_images_sort_order_positive" CHECK (("sort_order" >= 0))
);


ALTER TABLE "public"."machine_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."machines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "year" "text",
    "price" numeric,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "features" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "specs" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "name_en" "text",
    "description_en" "text",
    "features_en" "text"[],
    "specs_en" "jsonb",
    CONSTRAINT "machines_price_positive" CHECK ((("price" IS NULL) OR ("price" >= (0)::numeric))),
    CONSTRAINT "machines_slug_format" CHECK (("slug" ~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$'::"text")),
    CONSTRAINT "machines_status_values" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'reserved'::"text", 'sold'::"text"])))
);


ALTER TABLE "public"."machines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_role_values" CHECK (("role" = 'admin'::"text"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_notification_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "quote_request_id" "uuid",
    "payload" "jsonb" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "last_error" "text"
);


ALTER TABLE "public"."push_notification_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_request_id" "uuid" NOT NULL,
    "sender_type" "text" NOT NULL,
    "sender_email" "text",
    "body_text" "text" NOT NULL,
    "body_html" "text",
    "email_message_id" "text",
    "in_reply_to" "text",
    "has_attachments" boolean DEFAULT false NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "quote_messages_sender_type_check" CHECK (("sender_type" = ANY (ARRAY['customer'::"text", 'admin'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."quote_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "company" "text",
    "email" "text" NOT NULL,
    "phone" "text",
    "message" "text",
    "request_type" "text" NOT NULL,
    "machine_id" "uuid",
    "inventory_item_id" "uuid",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    CONSTRAINT "quote_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'completed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."quote_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "item_name" "text" NOT NULL,
    "item_category" "text",
    "sold_at" timestamp with time zone NOT NULL,
    "sold_price" integer,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sales_records_item_type_check" CHECK (("item_type" = ANY (ARRAY['machine'::"text", 'inventory'::"text"]))),
    CONSTRAINT "sales_records_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'reverted'::"text"])))
);


ALTER TABLE "public"."sales_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "machine_inquiries" boolean DEFAULT false NOT NULL,
    "inventory_inquiries" boolean DEFAULT false NOT NULL,
    "workshop_inquiries" boolean DEFAULT false NOT NULL,
    "transport_inquiries" boolean DEFAULT false NOT NULL,
    "customer_replies" boolean DEFAULT false NOT NULL,
    "new_users" boolean DEFAULT false NOT NULL,
    "system_notifications" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "general_inquiries" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."user_notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "role" "text" DEFAULT 'intern'::"text" NOT NULL,
    "permissions" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "job_role" "text" DEFAULT 'Ã–vrigt'::"text",
    CONSTRAINT "valid_roles" CHECK (("role" = ANY (ARRAY['superadmin'::"text", 'admin'::"text", 'employee'::"text", 'intern'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."inventory_images"
    ADD CONSTRAINT "inventory_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."machine_images"
    ADD CONSTRAINT "machine_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."machines"
    ADD CONSTRAINT "machines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."machines"
    ADD CONSTRAINT "machines_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_notification_queue"
    ADD CONSTRAINT "push_notification_queue_dedup_key" UNIQUE ("event_type", "quote_request_id");



ALTER TABLE ONLY "public"."push_notification_queue"
    ADD CONSTRAINT "push_notification_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_endpoint_key" UNIQUE ("user_id", "endpoint");



ALTER TABLE ONLY "public"."quote_messages"
    ADD CONSTRAINT "quote_messages_email_message_id_key" UNIQUE ("email_message_id");



ALTER TABLE ONLY "public"."quote_messages"
    ADD CONSTRAINT "quote_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_requests"
    ADD CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_records"
    ADD CONSTRAINT "sales_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_machine_images_machine_id" ON "public"."machine_images" USING "btree" ("machine_id", "sort_order");



CREATE INDEX "idx_machines_slug" ON "public"."machines" USING "btree" ("slug");



CREATE INDEX "idx_machines_status" ON "public"."machines" USING "btree" ("status");



CREATE INDEX "idx_push_queue_processed" ON "public"."push_notification_queue" USING "btree" ("processed_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "idx_push_subscriptions_user_id" ON "public"."push_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_quote_messages_created_at" ON "public"."quote_messages" USING "btree" ("created_at");



CREATE INDEX "idx_quote_messages_email_message_id" ON "public"."quote_messages" USING "btree" ("email_message_id");



CREATE INDEX "idx_quote_messages_quote_request_id" ON "public"."quote_messages" USING "btree" ("quote_request_id");



CREATE OR REPLACE TRIGGER "create_preferences_on_user_profile_insert" AFTER INSERT ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."create_default_notification_preferences"();



CREATE OR REPLACE TRIGGER "ensure_min_superadmin" BEFORE DELETE OR UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_last_superadmin_removal"();



CREATE OR REPLACE TRIGGER "machine_images_single_primary" AFTER INSERT OR UPDATE OF "is_primary" ON "public"."machine_images" FOR EACH ROW WHEN (("new"."is_primary" = true)) EXECUTE FUNCTION "public"."enforce_single_primary_image"();



CREATE OR REPLACE TRIGGER "machines_set_updated_at" BEFORE UPDATE ON "public"."machines" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "on_quote_message_push" AFTER INSERT ON "public"."quote_messages" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_push_on_customer_reply"();



CREATE OR REPLACE TRIGGER "on_quote_request_push" AFTER INSERT ON "public"."quote_requests" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_push_on_new_quote_request"();



CREATE OR REPLACE TRIGGER "set_inventory_updated_at" BEFORE UPDATE ON "public"."inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_inventory_updated_at"();



CREATE OR REPLACE TRIGGER "set_push_subscription_updated_at" BEFORE UPDATE ON "public"."push_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_push_subscription_updated_at"();



CREATE OR REPLACE TRIGGER "set_sales_records_updated_at" BEFORE UPDATE ON "public"."sales_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_sales_records_updated_at"();



ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_images"
    ADD CONSTRAINT "inventory_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."machine_images"
    ADD CONSTRAINT "machine_images_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_messages"
    ADD CONSTRAINT "quote_messages_quote_request_id_fkey" FOREIGN KEY ("quote_request_id") REFERENCES "public"."quote_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quote_requests"
    ADD CONSTRAINT "quote_requests_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quote_requests"
    ADD CONSTRAINT "quote_requests_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can update interns" ON "public"."user_profiles" FOR UPDATE USING (("public"."has_role"('admin'::"text") AND ("role" = 'intern'::"text")));



CREATE POLICY "Admins can insert preferences" ON "public"."user_notification_preferences" FOR INSERT WITH CHECK (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text")));



CREATE POLICY "Admins can read admins table" ON "public"."admins" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "Admins can read all preferences" ON "public"."user_notification_preferences" FOR SELECT USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text")));



CREATE POLICY "Admins can update all preferences" ON "public"."user_notification_preferences" FOR UPDATE USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text")));



CREATE POLICY "AnvÃ¤ndare kan lÃ¤sa sin egen profil" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Public can insert quote messages" ON "public"."quote_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can insert quote requests" ON "public"."quote_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can read inventory images" ON "public"."inventory_images" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."inventory_items"
  WHERE (("inventory_items"."id" = "inventory_images"."item_id") AND ("inventory_items"."status" = 'published'::"text")))));



CREATE POLICY "Public can read machine images" ON "public"."machine_images" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."machines"
  WHERE (("machines"."id" = "machine_images"."machine_id") AND ("machines"."status" = 'published'::"text")))));



CREATE POLICY "Public can read own quote messages" ON "public"."quote_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."quote_requests"
  WHERE (("quote_requests"."id" = "quote_messages"."quote_request_id") AND ("quote_requests"."email" = "quote_messages"."sender_email")))));



CREATE POLICY "Public can read published inventory" ON "public"."inventory_items" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "Public can read published machines" ON "public"."machines" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "RBAC Delete inventory" ON "public"."inventory_items" FOR DELETE USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_permission"('inventory:delete'::"text")));



CREATE POLICY "RBAC Delete machines" ON "public"."machines" FOR DELETE USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_permission"('machines:delete'::"text")));



CREATE POLICY "RBAC Delete quote requests" ON "public"."quote_requests" FOR DELETE USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_permission"('quotes:delete'::"text")));



CREATE POLICY "RBAC Delete sales" ON "public"."sales_records" FOR DELETE USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_permission"('sales:delete'::"text")));



CREATE POLICY "RBAC Insert inventory" ON "public"."inventory_items" FOR INSERT WITH CHECK (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_role"('employee'::"text") OR "public"."has_permission"('inventory:write'::"text")));



CREATE POLICY "RBAC Insert machines" ON "public"."machines" FOR INSERT WITH CHECK (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_role"('employee'::"text") OR "public"."has_permission"('machines:write'::"text")));



CREATE POLICY "RBAC Insert quote messages" ON "public"."quote_messages" FOR INSERT WITH CHECK (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_permission"('quotes:write'::"text")));



CREATE POLICY "RBAC Insert sales" ON "public"."sales_records" FOR INSERT WITH CHECK (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_permission"('sales:write'::"text")));



CREATE POLICY "RBAC Read inventory" ON "public"."inventory_items" FOR SELECT USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_role"('employee'::"text") OR "public"."has_permission"('inventory:read'::"text")));



CREATE POLICY "RBAC Read inventory images" ON "public"."inventory_images" FOR SELECT USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_role"('employee'::"text") OR "public"."has_permission"('inventory:read'::"text")));



CREATE POLICY "RBAC Read machine images" ON "public"."machine_images" FOR SELECT USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_role"('employee'::"text") OR "public"."has_permission"('machines:read'::"text")));



CREATE POLICY "RBAC Read machines" ON "public"."machines" FOR SELECT USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_role"('employee'::"text") OR "public"."has_permission"('machines:read'::"text")));



CREATE POLICY "RBAC Read quote messages" ON "public"."quote_messages" FOR SELECT USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_role"('employee'::"text") OR "public"."has_permission"('quotes:read'::"text")));



CREATE POLICY "RBAC Read quote requests" ON "public"."quote_requests" FOR SELECT USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_role"('employee'::"text") OR "public"."has_permission"('quotes:read'::"text")));



CREATE POLICY "RBAC Read sales" ON "public"."sales_records" FOR SELECT USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_permission"('sales:read'::"text")));



CREATE POLICY "RBAC Update inventory" ON "public"."inventory_items" FOR UPDATE USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_role"('employee'::"text") OR "public"."has_permission"('inventory:write'::"text")));



CREATE POLICY "RBAC Update machines" ON "public"."machines" FOR UPDATE USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_role"('employee'::"text") OR "public"."has_permission"('machines:write'::"text")));



CREATE POLICY "RBAC Update quote messages" ON "public"."quote_messages" FOR UPDATE USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_permission"('quotes:write'::"text")));



CREATE POLICY "RBAC Update quote requests" ON "public"."quote_requests" FOR UPDATE USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_permission"('quotes:write'::"text")));



CREATE POLICY "RBAC Update sales" ON "public"."sales_records" FOR UPDATE USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_permission"('sales:write'::"text")));



CREATE POLICY "RBAC Write inventory images" ON "public"."inventory_images" USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_role"('employee'::"text") OR "public"."has_permission"('inventory:write'::"text")));



CREATE POLICY "RBAC Write machine images" ON "public"."machine_images" USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR "public"."has_role"('employee'::"text") OR "public"."has_permission"('machines:write'::"text")));



CREATE POLICY "Superadmin and admin can read profiles" ON "public"."user_profiles" FOR SELECT USING (("public"."has_role"('superadmin'::"text") OR "public"."has_role"('admin'::"text") OR ("auth"."uid"() = "id")));



CREATE POLICY "Superadmin can update any profile" ON "public"."user_profiles" FOR UPDATE USING ("public"."has_role"('superadmin'::"text"));



CREATE POLICY "Users can insert own preferences" ON "public"."user_notification_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own preferences" ON "public"."user_notification_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own preferences" ON "public"."user_notification_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own push subscriptions" ON "public"."push_subscriptions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."machine_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."machines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_notification_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admins" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admins" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."admins" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."inventory_images" TO "anon";
GRANT ALL ON TABLE "public"."inventory_images" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."inventory_images" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."inventory_items" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."machine_images" TO "anon";
GRANT ALL ON TABLE "public"."machine_images" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."machine_images" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."machines" TO "anon";
GRANT ALL ON TABLE "public"."machines" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."machines" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."push_notification_queue" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."push_notification_queue" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."push_notification_queue" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."quote_messages" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."quote_messages" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."quote_messages" TO "service_role";



GRANT INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."quote_requests" TO "anon";
GRANT ALL ON TABLE "public"."quote_requests" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."quote_requests" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."sales_records" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."sales_records" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."sales_records" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notification_preferences" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."user_profiles" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";









-- Manual Storage Bucket Definitions for Test Environment
INSERT INTO storage.buckets (id, name, public) VALUES ('machine-images', 'machine-images', true), ('inventory-images', 'inventory-images', true), ('quote-attachments', 'quote-attachments', false) ON CONFLICT (id) DO NOTHING;
