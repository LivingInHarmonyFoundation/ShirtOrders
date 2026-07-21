-- ─────────────────────────────────────────────────────────────────────────────
-- 034_personal_shipping_rates.sql
-- Location-based shipping for personal orders: two configurable flat rates chosen
-- by the delivery ZIP (Puerto Rico ZIPs 00600–00999 → PR rate; anything else →
-- off-island rate). Replaces the old flat "Shipping & Handling" order fee.
--
-- Defaults are 0; the go-live data step seeds them from the prior flat fee so
-- pricing is unchanged until an admin sets a distinct off-island rate.
-- Additive and non-destructive.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS personal_shipping_pr    NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personal_shipping_other NUMERIC NOT NULL DEFAULT 0;
