-- 1. Safely add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_items' AND column_name = 'slug'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN slug TEXT;
  END IF;
END $$;

-- 2. Create a temporary function with a highly specific name to prevent conflicts
CREATE OR REPLACE FUNCTION temp_generate_inventory_slug(name TEXT, item_id UUID) RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  test_slug TEXT;
  counter INT := 1;
BEGIN
  -- Handle NULL or empty name
  IF name IS NULL OR trim(name) = '' THEN
    base_slug := 'item-' || substr(item_id::text, 1, 8);
  ELSE
    -- Lowercase and basic replacement
    base_slug := lower(name);
    base_slug := replace(base_slug, 'å', 'a');
    base_slug := replace(base_slug, 'ä', 'a');
    base_slug := replace(base_slug, 'ö', 'o');
    -- Replace any non-alphanumeric character with a hyphen
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
    -- Trim hyphens from start and end
    base_slug := trim(both '-' from base_slug);
    
    -- If the resulting slug is empty (e.g., name was only special characters)
    IF base_slug = '' THEN
      base_slug := 'item-' || substr(item_id::text, 1, 8);
    END IF;
  END IF;

  test_slug := base_slug;

  -- Ensure uniqueness loop
  WHILE EXISTS (SELECT 1 FROM inventory_items WHERE slug = test_slug AND id != item_id) LOOP
    test_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;

  RETURN test_slug;
END;
$$ LANGUAGE plpgsql;

-- 3. Update existing items with a slug safely
DO $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN SELECT id, name FROM inventory_items WHERE slug IS NULL LOOP
    UPDATE inventory_items 
    SET slug = temp_generate_inventory_slug(item.name, item.id)
    WHERE id = item.id;
  END LOOP;
END;
$$;

-- 4. Clean up the temporary function
DROP FUNCTION temp_generate_inventory_slug(TEXT, UUID);

-- 5. Add the UNIQUE constraint now that all data is populated and verified
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_slug_key'
  ) THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_slug_key UNIQUE (slug);
  END IF;
END $$;
