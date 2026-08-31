-- Skapar tabell för försäljningshistorik (Sales Records)
CREATE TABLE sales_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('machine', 'inventory')),
  item_name text NOT NULL,
  item_category text,
  sold_at timestamptz NOT NULL,
  sold_price integer,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'reverted')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Uppdateringstrigger för updated_at
CREATE OR REPLACE FUNCTION update_sales_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_sales_records_updated_at
  BEFORE UPDATE ON sales_records
  FOR EACH ROW EXECUTE FUNCTION update_sales_records_updated_at();

-- RLS (Row Level Security)
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;

-- Inloggade administratörer kan göra allt
CREATE POLICY "Auth users can manage sales_records"
  ON sales_records FOR ALL USING (auth.role() = 'authenticated');
