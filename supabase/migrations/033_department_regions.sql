-- ─────────────────────────────────────────────────────────────────────────────
-- 033_department_regions.sql
-- Adds an optional third level under government agencies: per-department regions.
--
-- - government_orgs.department_regions: JSONB map of { "<department name>": ["<region>", ...] }.
--   Keyed by the department name so it lives alongside the existing `departments` TEXT[]
--   without disturbing already-configured departments. A department absent from the map
--   (or with an empty array) simply has no region step at checkout.
-- - orders.region: the region the customer selected (nullable; only set for government
--   orders whose chosen department defines regions).
--
-- Both changes are additive and non-destructive.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE government_orgs
  ADD COLUMN IF NOT EXISTS department_regions JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS region TEXT;
