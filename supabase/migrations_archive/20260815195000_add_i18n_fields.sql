-- Add i18n English fields to inventory_items
ALTER TABLE inventory_items
ADD COLUMN name_en text NULL,
ADD COLUMN description_en text NULL;

-- Add i18n English fields to machines
ALTER TABLE machines
ADD COLUMN name_en text NULL,
ADD COLUMN description_en text NULL,
ADD COLUMN features_en text[] NULL,
ADD COLUMN specs_en jsonb NULL;
