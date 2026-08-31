-- 1. Skapa Storage bucket: quote-attachments (privat)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('quote-attachments', 'quote-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies för quote-attachments
-- Återanvänder befintlig modell där auth.role() = 'authenticated'
-- är grundkravet för interna funktioner (RBAC skyddar i övrigt UI och tabeller).

-- Läsbehörighet
CREATE POLICY "Auth can read quote-attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'quote-attachments' 
    AND auth.role() = 'authenticated'
  );

-- Uppladdningsbehörighet
CREATE POLICY "Auth can upload quote-attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'quote-attachments' 
    AND auth.role() = 'authenticated'
  );

-- Borttagningsbehörighet
CREATE POLICY "Auth can delete quote-attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'quote-attachments' 
    AND auth.role() = 'authenticated'
  );

-- 3. Lägg till attachments kolumn i quote_messages
ALTER TABLE quote_messages 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
