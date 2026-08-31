-- Public Read for inventory-images
CREATE POLICY "Public Read inventory-images" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'inventory-images');

-- RBAC Insert for inventory-images
CREATE POLICY "RBAC Insert inventory-images" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inventory-images' AND 
  (
    public.has_role('superadmin') OR 
    public.has_role('admin') OR 
    public.has_role('employee') OR 
    public.has_permission('inventory:write')
  )
);

-- RBAC Update for inventory-images
CREATE POLICY "RBAC Update inventory-images" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'inventory-images' AND 
  (
    public.has_role('superadmin') OR 
    public.has_role('admin') OR 
    public.has_role('employee') OR 
    public.has_permission('inventory:write')
  )
);

-- RBAC Delete for inventory-images
CREATE POLICY "RBAC Delete inventory-images" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'inventory-images' AND 
  (
    public.has_role('superadmin') OR 
    public.has_role('admin') OR 
    public.has_role('employee') OR 
    public.has_permission('inventory:delete')
  )
);
