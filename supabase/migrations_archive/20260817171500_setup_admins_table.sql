-- 1. Skapa admins-tabellen
CREATE TABLE admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Aktivera RLS på admins
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- 2. Skapa en SECURITY DEFINER funktion för att säkert och effektivt kontrollera adminstatus.
--    Detta undviker oändliga rekursionsloopar när RLS-policys utvärderas.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM admins 
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Policy för att låta admins läsa admins-tabellen
CREATE POLICY "Admins can read admins table"
  ON admins FOR SELECT 
  USING (is_admin());

-- 4. Policy för att endast admins får radera förfrågningar
CREATE POLICY "Admin users can delete quote requests"
  ON quote_requests FOR DELETE 
  USING (is_admin());
