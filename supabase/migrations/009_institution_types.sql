-- Drop the existing check constraint and add the new one with all four types
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_institution_type_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_institution_type_check
  CHECK (institution_type IN ('school', 'government', 'personal', 'private_company'));

-- Add fields used by the new types
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS company_department TEXT;

-- Settings toggles for the new types
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS personal_orders_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS private_company_orders_enabled BOOLEAN NOT NULL DEFAULT true;
