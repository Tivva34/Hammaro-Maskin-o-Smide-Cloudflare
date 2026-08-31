-- Public Read for machine-images
CREATE POLICY "Public Read machine-images" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'machine-images');

-- RBAC Insert for machine-images
CREATE POLICY "RBAC Insert machine-images" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'machine-images' AND 
  (
    public.has_role('superadmin') OR 
    public.has_role('admin') OR 
    public.has_role('employee') OR 
    public.has_permission('machines:write')
  )
);

-- RBAC Update for machine-images
CREATE POLICY "RBAC Update machine-images" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'machine-images' AND 
  (
    public.has_role('superadmin') OR 
    public.has_role('admin') OR 
    public.has_role('employee') OR 
    public.has_permission('machines:write')
  )
);

-- RBAC Delete for machine-images
CREATE POLICY "RBAC Delete machine-images" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'machine-images' AND 
  (
    public.has_role('superadmin') OR 
    public.has_role('admin') OR 
    public.has_role('employee') OR 
    public.has_permission('machines:delete')
  )
);
