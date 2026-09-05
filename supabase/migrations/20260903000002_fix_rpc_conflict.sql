-- Fix the RPC to use ON CONFLICT (endpoint) instead of (user_id, endpoint)
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be logged in to claim push subscription';
  END IF;

  DELETE FROM public.push_subscriptions 
  WHERE endpoint = p_endpoint AND user_id != auth.uid();
  
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent, NOW())
  ON CONFLICT (endpoint) 
  DO UPDATE SET 
    user_id = EXCLUDED.user_id,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = EXCLUDED.user_agent,
    updated_at = EXCLUDED.updated_at;
END;
$$;
