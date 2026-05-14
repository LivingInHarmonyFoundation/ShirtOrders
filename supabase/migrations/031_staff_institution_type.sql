-- Add 'staff' as a valid institution type and an admin toggle for it.
-- Drops and recreates the check constraint to include the new value.
-- Default is OFF (false) — admins must explicitly enable staff ordering.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_institution_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_institution_type_check
  CHECK (institution_type IN ('school', 'government', 'personal', 'private_company', 'staff'));

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS staff_orders_enabled BOOLEAN NOT NULL DEFAULT false;
