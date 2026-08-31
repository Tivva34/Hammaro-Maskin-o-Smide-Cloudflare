-- Skapar tabell för Lösöre (Yttre lösöre och övrigt till salu)
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  name text NOT NULL,
  description text,
  price integer,
  status text DEFAULT 'draft' NOT NULL,
  CONSTRAINT inventory_status_check CHECK (status IN ('draft','published','reserved','sold'))
);

-- Skapar tabell för lösöresbilder
CREATE TABLE inventory_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  storage_path text NOT NULL,
  alt_text text,
  is_primary boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Uppdateringstrigger för updated_at
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_inventory_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();

-- RLS (Row Level Security)
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_images ENABLE ROW LEVEL SECURITY;

-- Publik kan endast läsa publicerat lösöre
CREATE POLICY "Public can read published inventory"
  ON inventory_items FOR SELECT USING (status = 'published');

CREATE POLICY "Public can read inventory images"
  ON inventory_images FOR SELECT USING (
    EXISTS (SELECT 1 FROM inventory_items WHERE id = item_id AND status = 'published')
  );

-- Inloggade administratörer kan göra allt
CREATE POLICY "Auth users can manage inventory"
  ON inventory_items FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can manage inventory images"
  ON inventory_images FOR ALL USING (auth.role() = 'authenticated');
