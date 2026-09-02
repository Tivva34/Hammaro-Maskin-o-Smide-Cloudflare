-- 1. Säkert search_path för att förhindra s.k. search_path hijacking
CREATE OR REPLACE FUNCTION public.claim_push_subscription(
  p_endpoint text, 
  p_p256dh text, 
  p_auth text, 
  p_user_agent text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 2. Kräv auth.uid() (säkerställ att den inte anropas anonymt)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be logged in to claim push subscription';
  END IF;

  -- 3. Städa bort endpointen om den finns på NÅGON ANNAN användare (hanterar race conditions)
  DELETE FROM public.push_subscriptions 
  WHERE endpoint = p_endpoint AND user_id != auth.uid();
  
  -- 4. Upserta (skapa eller uppdatera) för den AKTUELLA användaren
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent, NOW())
  ON CONFLICT (user_id, endpoint) 
  DO UPDATE SET 
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- 5. Se till att ENDAST inloggade kan använda funktionen
REVOKE ALL ON FUNCTION public.claim_push_subscription(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_push_subscription(text, text, text, text) TO authenticated;

-- 6. Clean up any existing duplicate endpoints before adding constraint
DELETE FROM public.push_subscriptions
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY endpoint ORDER BY updated_at DESC) as rnum
    FROM public.push_subscriptions
  ) t WHERE t.rnum = 1
);

-- 7. Add UNIQUE constraint to endpoint
ALTER TABLE public.push_subscriptions
DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_key;

ALTER TABLE public.push_subscriptions
ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);