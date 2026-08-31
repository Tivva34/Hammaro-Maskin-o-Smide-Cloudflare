-- Ersätt befintliga RBAC-funktioner med säkra varianter för Supabase Realtime
-- Vi lägger till SET search_path = public och fully qualified names (public.*)
-- så att funktionerna inte misslyckas i Realtime-motorns begränsade kontext.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
DECLARE
  u_role text;
BEGIN
  SELECT role INTO u_role FROM public.user_profiles WHERE id = auth.uid() AND is_active = true;
  RETURN u_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN public.get_user_role() = required_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.has_permission(required_permission text)
RETURNS boolean AS $$
DECLARE
  u_permissions text[];
BEGIN
  SELECT permissions INTO u_permissions FROM public.user_profiles WHERE id = auth.uid() AND is_active = true;
  RETURN required_permission = ANY(u_permissions);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
