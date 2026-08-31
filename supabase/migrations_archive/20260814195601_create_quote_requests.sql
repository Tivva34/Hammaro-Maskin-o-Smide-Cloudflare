-- Skapar tabell för förfrågningar (leads)
CREATE TABLE quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  name text NOT NULL,
  company text,
  email text NOT NULL,
  phone text,
  message text,
  request_type text NOT NULL,           
  machine_id uuid REFERENCES machines(id) ON DELETE SET NULL,
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  status text DEFAULT 'new' NOT NULL,
  CONSTRAINT quote_status_check CHECK (status IN ('new','contacted','completed','archived'))
);

-- RLS (Row Level Security)
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Publik kan enbart skapa förfrågningar (INSERT), inte läsa andras (SELECT)
CREATE POLICY "Public can insert quote requests"
  ON quote_requests FOR INSERT WITH CHECK (true);

-- Inloggade administratörer har full åtkomst att läsa och uppdatera
CREATE POLICY "Auth users can read quote requests"
  ON quote_requests FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update quote requests"
  ON quote_requests FOR UPDATE USING (auth.role() = 'authenticated');
