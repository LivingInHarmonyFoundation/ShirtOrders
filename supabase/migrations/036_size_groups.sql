-- ─────────────────────────────────────────────────────────────────────────────
-- 036_size_groups.sql
-- Admin-defined size categories for the order form. `size_groups` is a JSONB
-- array of { "name": string, "sizes": string[] } — customers pick a category
-- box first (e.g. Adultos / Jóvenes / Niños) and then see only that category's
-- sizes. Empty array (default) → the app derives sensible default categories
-- from the size names (see deriveDefaultSizeGroups in lib/utils).
-- Additive and non-destructive.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS size_groups JSONB NOT NULL DEFAULT '[]'::jsonb;
