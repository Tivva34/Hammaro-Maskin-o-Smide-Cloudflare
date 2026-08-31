-- 1. Ta bort den befintliga constrainten
ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS valid_roles;

-- 2. Lägg till den uppdaterade constrainten som även tillåter 'employee'
ALTER TABLE public.user_profiles 
ADD CONSTRAINT valid_roles 
CHECK (role IN ('superadmin', 'admin', 'employee', 'intern'));
