-- 1. Clean up any existing duplicate endpoints before adding constraint
DELETE FROM public.push_subscriptions
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY endpoint ORDER BY updated_at DESC) as rnum
    FROM public.push_subscriptions
  ) t WHERE t.rnum = 1
);

-- 2. Drop the old composite constraint
ALTER TABLE public.push_subscriptions
DROP CONSTRAINT IF EXISTS push_subscriptions_user_endpoint_key;

-- Also try dropping alternative name just in case Supabase generated a different default name
ALTER TABLE public.push_subscriptions
DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_endpoint_key;

-- Drop the endpoint key if it already exists from a previous partial run
ALTER TABLE public.push_subscriptions
DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_key;

-- 3. Add the new globally unique constraint on endpoint
ALTER TABLE public.push_subscriptions
ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
