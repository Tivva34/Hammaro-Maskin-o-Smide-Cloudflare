-- 1. Update valid_roles constraint to include 'employee'
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS valid_roles;
ALTER TABLE public.user_profiles ADD CONSTRAINT valid_roles CHECK (role IN ('superadmin', 'admin', 'employee', 'intern'));

-- 2. Fix RLS recursion on user_profiles
-- Instead of using has_role() which queries user_profiles, users can only SELECT their OWN profile directly.
-- The UsersPanel will use the Edge Function (service role) to list all users, bypassing RLS.
DROP POLICY IF EXISTS "Superadmin and admin can read profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;

CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

-- 3. Update has_permission() to handle implicit access for 'employee' and 'admin'
-- This avoids rewriting all the RLS policies in the database.
CREATE OR REPLACE FUNCTION public.has_permission(required_permission text)
RETURNS boolean AS $$
DECLARE
  u_role text;
  u_permissions text[];
BEGIN
  SELECT role, permissions INTO u_role, u_permissions FROM public.user_profiles WHERE id = auth.uid() AND is_active = true;
  
  -- Superadmin gets access to everything
  IF u_role = 'superadmin' THEN
    RETURN true;
  END IF;
  
  -- Admin gets full operational access and stats, but NOT roles/superadmin management
  IF u_role = 'admin' THEN
    IF required_permission LIKE 'machines:%' OR 
       required_permission LIKE 'inventory:%' OR 
       required_permission LIKE 'sales:%' OR 
       required_permission LIKE 'quotes:%' OR 
       required_permission = 'statistics:read' OR
       required_permission = 'users:read' OR
       required_permission = 'users:invite' THEN
       RETURN true;
    END IF;
    -- Admin is explicitly denied these permissions, just in case
    IF required_permission IN ('users:delete', 'roles:admin', 'roles:superadmin') THEN
       RETURN false;
    END IF;
  END IF;

  -- Employee gets operational access, but NO stats and NO user management
  IF u_role = 'employee' THEN
    IF required_permission LIKE 'machines:%' OR 
       required_permission LIKE 'inventory:%' OR 
       required_permission LIKE 'quotes:%' THEN
       RETURN true;
    END IF;
    -- Employee is explicitly denied these
    IF required_permission = 'statistics:read' OR required_permission LIKE 'users:%' OR required_permission LIKE 'roles:%' THEN
       RETURN false;
    END IF;
  END IF;

  -- Fallback to checking the exact permission in the array (for Interns / granular overrides)
  IF u_permissions IS NOT NULL THEN
    RETURN required_permission = ANY(u_permissions);
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
