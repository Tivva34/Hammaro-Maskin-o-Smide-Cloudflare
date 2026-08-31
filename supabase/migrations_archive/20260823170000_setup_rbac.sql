-- 1. Skapa user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'intern',
  permissions text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_roles CHECK (role IN ('superadmin', 'admin', 'intern'))
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Hjälpfunktioner
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
DECLARE
  u_role text;
BEGIN
  SELECT role INTO u_role FROM public.user_profiles WHERE id = auth.uid() AND is_active = true;
  RETURN u_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION has_role(required_role text)
RETURNS boolean AS $$
BEGIN
  RETURN get_user_role() = required_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_permission(required_permission text)
RETURNS boolean AS $$
DECLARE
  u_permissions text[];
BEGIN
  SELECT permissions INTO u_permissions FROM public.user_profiles WHERE id = auth.uid() AND is_active = true;
  RETURN required_permission = ANY(u_permissions);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ny version av is_admin för bakåtkompatibilitet
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN has_role('superadmin') OR has_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Migration av befintliga admins
INSERT INTO user_profiles (id, email, name, role, is_active)
SELECT 
  a.user_id, 
  au.email,
  au.raw_user_meta_data->>'name',
  'superadmin', 
  true
FROM admins a
JOIN auth.users au ON a.user_id = au.id
ON CONFLICT (id) DO UPDATE SET role = 'superadmin', is_active = true;

-- 4. RLS för user_profiles
CREATE POLICY "Superadmin and admin can read profiles"
  ON user_profiles FOR SELECT
  USING (has_role('superadmin') OR has_role('admin') OR auth.uid() = id);

CREATE POLICY "Superadmin can update any profile"
  ON user_profiles FOR UPDATE
  USING (has_role('superadmin'));

CREATE POLICY "Admin can update interns"
  ON user_profiles FOR UPDATE
  USING (has_role('admin') AND role = 'intern');

-- 5. Rensa gamla policies för datatabeller och ersätta med nya RBAC-policys
DO $$ 
DECLARE 
    pol record;
BEGIN 
    -- Tar bort gamla policys för att undvika konflikter
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename IN (
            'machines', 'machine_images',
            'inventory_items', 'inventory_images',
            'sales_records',
            'quote_requests', 'quote_messages'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- ====== MACHINES ======
-- Public read
CREATE POLICY "Public can read published machines"
  ON machines FOR SELECT USING (status = 'published');

-- RBAC Read
CREATE POLICY "RBAC Read machines"
  ON machines FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_permission('machines:read'));

-- RBAC Insert
CREATE POLICY "RBAC Insert machines"
  ON machines FOR INSERT WITH CHECK (has_role('superadmin') OR has_role('admin') OR has_permission('machines:write'));

-- RBAC Update
CREATE POLICY "RBAC Update machines"
  ON machines FOR UPDATE USING (has_role('superadmin') OR has_role('admin') OR has_permission('machines:write'));

-- RBAC Delete
CREATE POLICY "RBAC Delete machines"
  ON machines FOR DELETE USING (has_role('superadmin') OR has_role('admin') OR has_permission('machines:delete'));

-- MACHINE IMAGES
CREATE POLICY "Public can read machine images"
  ON machine_images FOR SELECT USING (
    EXISTS (SELECT 1 FROM machines WHERE id = machine_id AND status = 'published')
  );
CREATE POLICY "RBAC Read machine images"
  ON machine_images FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_permission('machines:read'));
CREATE POLICY "RBAC Write machine images"
  ON machine_images FOR ALL USING (has_role('superadmin') OR has_role('admin') OR has_permission('machines:write'));

-- ====== INVENTORY ITEMS ======
CREATE POLICY "Public can read published inventory"
  ON inventory_items FOR SELECT USING (status = 'published');

CREATE POLICY "RBAC Read inventory"
  ON inventory_items FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_permission('inventory:read'));

CREATE POLICY "RBAC Insert inventory"
  ON inventory_items FOR INSERT WITH CHECK (has_role('superadmin') OR has_role('admin') OR has_permission('inventory:write'));

CREATE POLICY "RBAC Update inventory"
  ON inventory_items FOR UPDATE USING (has_role('superadmin') OR has_role('admin') OR has_permission('inventory:write'));

CREATE POLICY "RBAC Delete inventory"
  ON inventory_items FOR DELETE USING (has_role('superadmin') OR has_role('admin') OR has_permission('inventory:delete'));

-- INVENTORY IMAGES
CREATE POLICY "Public can read inventory images"
  ON inventory_images FOR SELECT USING (
    EXISTS (SELECT 1 FROM inventory_items WHERE id = item_id AND status = 'published')
  );
CREATE POLICY "RBAC Read inventory images"
  ON inventory_images FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_permission('inventory:read'));
CREATE POLICY "RBAC Write inventory images"
  ON inventory_images FOR ALL USING (has_role('superadmin') OR has_role('admin') OR has_permission('inventory:write'));

-- ====== SALES RECORDS ======
CREATE POLICY "RBAC Read sales"
  ON sales_records FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_permission('sales:read'));
CREATE POLICY "RBAC Insert sales"
  ON sales_records FOR INSERT WITH CHECK (has_role('superadmin') OR has_role('admin') OR has_permission('sales:write'));
CREATE POLICY "RBAC Update sales"
  ON sales_records FOR UPDATE USING (has_role('superadmin') OR has_role('admin') OR has_permission('sales:write'));
CREATE POLICY "RBAC Delete sales"
  ON sales_records FOR DELETE USING (has_role('superadmin') OR has_role('admin') OR has_permission('sales:delete'));

-- ====== QUOTE REQUESTS ======
CREATE POLICY "Public can insert quote requests"
  ON quote_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "RBAC Read quote requests"
  ON quote_requests FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_permission('quotes:read'));
CREATE POLICY "RBAC Update quote requests"
  ON quote_requests FOR UPDATE USING (has_role('superadmin') OR has_role('admin') OR has_permission('quotes:write'));
CREATE POLICY "RBAC Delete quote requests"
  ON quote_requests FOR DELETE USING (has_role('superadmin') OR has_role('admin') OR has_permission('quotes:delete'));

-- ====== QUOTE MESSAGES ======
CREATE POLICY "Public can insert quote messages"
  ON quote_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read own quote messages"
  ON quote_messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quote_requests 
      WHERE quote_requests.id = quote_messages.quote_request_id 
      AND quote_requests.email = quote_messages.sender_email
    )
  );
CREATE POLICY "RBAC Read quote messages"
  ON quote_messages FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_permission('quotes:read'));
CREATE POLICY "RBAC Insert quote messages"
  ON quote_messages FOR INSERT WITH CHECK (has_role('superadmin') OR has_role('admin') OR has_permission('quotes:write'));
