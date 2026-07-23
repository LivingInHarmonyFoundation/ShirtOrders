-- ─────────────────────────────────────────────────────────────────────────────
-- 035_size_prices.sql
-- Per-size price overrides for a catalog item. `size_prices` is a JSONB map of
-- { "<size>": <price> } for sizes that cost something other than the item's base
-- `price`. Sizes absent from the map fall back to `price` (and then the global
-- shirt_price). Lets an admin price, e.g., XXL/XXXL higher without setting a price
-- for every size. Additive and non-destructive.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE shirt_catalog
  ADD COLUMN IF NOT EXISTS size_prices JSONB NOT NULL DEFAULT '{}'::jsonb;
