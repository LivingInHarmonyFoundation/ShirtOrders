-- Add per-item price and available sizes to shirt_catalog.
-- NULL means "use the global app_settings value" (backward compat).
ALTER TABLE shirt_catalog
  ADD COLUMN IF NOT EXISTS price           DECIMAL(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS available_sizes TEXT[]        DEFAULT NULL;
