-- 1. Create a function to prevent deleting, deactivating, or demoting the last superadmin
CREATE OR REPLACE FUNCTION public.prevent_last_superadmin_removal()
RETURNS TRIGGER AS $$
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
            RAISE EXCEPTION 'Säkerhetsspärr: Kan inte radera, inaktivera eller degradera den sista aktiva Superadmin-användaren.';
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Create the trigger on user_profiles
DROP TRIGGER IF EXISTS ensure_min_superadmin ON public.user_profiles;
CREATE TRIGGER ensure_min_superadmin
BEFORE UPDATE OR DELETE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_superadmin_removal();
