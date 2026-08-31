-- A. Grundbehörigheter för RLS (GRANTs)
GRANT SELECT ON inventory_items TO anon;
GRANT SELECT ON inventory_images TO anon;
GRANT INSERT ON quote_requests TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_images TO authenticated;
GRANT SELECT, UPDATE ON quote_requests TO authenticated;


-- B. Skapa Storage bucket: inventory-images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('inventory-images', 'inventory-images', true)
ON CONFLICT (id) DO NOTHING;


-- C. Storage Policies
-- 1. Publik kan läsa bilder
CREATE POLICY "Public can read inventory-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'inventory-images');

-- 2. Authenticated kan ladda upp (skapa)
CREATE POLICY "Auth can upload inventory-images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'inventory-images' 
    AND auth.role() = 'authenticated'
  );

-- 3. Authenticated kan uppdatera (skriva över)
CREATE POLICY "Auth can update inventory-images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'inventory-images' 
    AND auth.role() = 'authenticated'
  );

-- 4. Authenticated kan ta bort
CREATE POLICY "Auth can delete inventory-images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'inventory-images' 
    AND auth.role() = 'authenticated'
  );
