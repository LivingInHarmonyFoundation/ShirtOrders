-- Add selected shirt catalog item to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES shirt_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalog_item_name TEXT;
