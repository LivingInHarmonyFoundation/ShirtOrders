-- Add per-institution-type cash payment toggles to app_settings.
-- The global cash_enabled column is kept for backward compat but is no longer
-- used by the checkout page — the three new columns take over for school,
-- government, and private_company orders. Personal orders continue to use
-- personal_allowed_payment_methods.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS cash_enabled_school        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cash_enabled_government    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cash_enabled_private_company boolean NOT NULL DEFAULT false;
