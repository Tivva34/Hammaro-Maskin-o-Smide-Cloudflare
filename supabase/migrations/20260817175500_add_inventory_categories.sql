-- Add category to inventory items
ALTER TABLE inventory_items 
ADD COLUMN category text DEFAULT 'other' NOT NULL;

ALTER TABLE inventory_items
ADD CONSTRAINT inventory_category_check 
CHECK (category IN ('agriculture', 'construction', 'workshop', 'tires', 'parts', 'other'));
