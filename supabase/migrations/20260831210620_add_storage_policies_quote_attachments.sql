-- RBAC Read for quote-attachments
CREATE POLICY "RBAC Read quote-attachments" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'quote-attachments' AND 
  (
    public.has_role('superadmin') OR 
    public.has_role('admin') OR 
    public.has_role('employee') OR 
    public.has_permission('quotes:read') OR
    public.has_permission('quotes:write')
  )
);

-- RBAC Insert for quote-attachments
CREATE POLICY "RBAC Insert quote-attachments" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quote-attachments' AND 
  (
    public.has_role('superadmin') OR 
    public.has_role('admin') OR 
    public.has_role('employee') OR 
    public.has_permission('quotes:write')
  )
);

-- RBAC Update for quote-attachments
CREATE POLICY "RBAC Update quote-attachments" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'quote-attachments' AND 
  (
    public.has_role('superadmin') OR 
    public.has_role('admin') OR 
    public.has_role('employee') OR 
    public.has_permission('quotes:write')
  )
);

-- RBAC Delete for quote-attachments
CREATE POLICY "RBAC Delete quote-attachments" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'quote-attachments' AND 
  (
    public.has_role('superadmin') OR 
    public.has_role('admin') OR 
    public.has_role('employee') OR 
    public.has_permission('quotes:delete')
  )
);
