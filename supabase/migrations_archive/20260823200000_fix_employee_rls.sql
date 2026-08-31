-- Uppdatera RLS för machines
DROP POLICY IF EXISTS "RBAC Read machines" ON machines;
CREATE POLICY "RBAC Read machines" ON machines FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_role('employee') OR has_permission('machines:read'));

DROP POLICY IF EXISTS "RBAC Insert machines" ON machines;
CREATE POLICY "RBAC Insert machines" ON machines FOR INSERT WITH CHECK (has_role('superadmin') OR has_role('admin') OR has_role('employee') OR has_permission('machines:write'));

DROP POLICY IF EXISTS "RBAC Update machines" ON machines;
CREATE POLICY "RBAC Update machines" ON machines FOR UPDATE USING (has_role('superadmin') OR has_role('admin') OR has_role('employee') OR has_permission('machines:write'));

-- Uppdatera RLS för machine_images
DROP POLICY IF EXISTS "RBAC Read machine images" ON machine_images;
CREATE POLICY "RBAC Read machine images" ON machine_images FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_role('employee') OR has_permission('machines:read'));

DROP POLICY IF EXISTS "RBAC Write machine images" ON machine_images;
CREATE POLICY "RBAC Write machine images" ON machine_images FOR ALL USING (has_role('superadmin') OR has_role('admin') OR has_role('employee') OR has_permission('machines:write'));

-- Uppdatera RLS för inventory_items
DROP POLICY IF EXISTS "RBAC Read inventory" ON inventory_items;
CREATE POLICY "RBAC Read inventory" ON inventory_items FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_role('employee') OR has_permission('inventory:read'));

DROP POLICY IF EXISTS "RBAC Insert inventory" ON inventory_items;
CREATE POLICY "RBAC Insert inventory" ON inventory_items FOR INSERT WITH CHECK (has_role('superadmin') OR has_role('admin') OR has_role('employee') OR has_permission('inventory:write'));

DROP POLICY IF EXISTS "RBAC Update inventory" ON inventory_items;
CREATE POLICY "RBAC Update inventory" ON inventory_items FOR UPDATE USING (has_role('superadmin') OR has_role('admin') OR has_role('employee') OR has_permission('inventory:write'));

-- Uppdatera RLS för inventory_images
DROP POLICY IF EXISTS "RBAC Read inventory images" ON inventory_images;
CREATE POLICY "RBAC Read inventory images" ON inventory_images FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_role('employee') OR has_permission('inventory:read'));

DROP POLICY IF EXISTS "RBAC Write inventory images" ON inventory_images;
CREATE POLICY "RBAC Write inventory images" ON inventory_images FOR ALL USING (has_role('superadmin') OR has_role('admin') OR has_role('employee') OR has_permission('inventory:write'));

-- Uppdatera RLS för quote_requests
DROP POLICY IF EXISTS "RBAC Read quote requests" ON quote_requests;
CREATE POLICY "RBAC Read quote requests" ON quote_requests FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_role('employee') OR has_permission('quotes:read'));

-- Uppdatera RLS för quote_messages
DROP POLICY IF EXISTS "RBAC Read quote messages" ON quote_messages;
CREATE POLICY "RBAC Read quote messages" ON quote_messages FOR SELECT USING (has_role('superadmin') OR has_role('admin') OR has_role('employee') OR has_permission('quotes:read'));
