-- 016_entity_enhancements.sql
-- Private company links, per-org departments, per-school grades, per-entity payment controls

-- ── Private Companies: add slug (unique shareable link) ──────────────────────
ALTER TABLE private_companies
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS allowed_payment_methods TEXT[];

CREATE INDEX IF NOT EXISTS private_companies_slug_idx ON private_companies(slug);

-- Back-fill slugs for any existing company rows
DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  candidate TEXT;
  suffix TEXT;
  tries INT;
BEGIN
  FOR rec IN SELECT id, name FROM private_companies WHERE slug IS NULL LOOP
    base_slug := lower(regexp_replace(regexp_replace(rec.name, '[^a-z0-9 ]', '', 'gi'), '\s+', '-', 'g'));
    base_slug := left(base_slug, 40);
    tries := 0;
    LOOP
      suffix := left(md5(random()::text), 4);
      candidate := base_slug || '-' || suffix;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM private_companies WHERE slug = candidate);
      tries := tries + 1;
      EXIT WHEN tries > 10;
    END LOOP;
    UPDATE private_companies SET slug = candidate WHERE id = rec.id;
  END LOOP;
END $$;

-- Make slug NOT NULL after back-fill
ALTER TABLE private_companies ALTER COLUMN slug SET NOT NULL;

-- ── Government Orgs: add departments list ────────────────────────────────────
ALTER TABLE government_orgs
  ADD COLUMN IF NOT EXISTS departments TEXT[],
  ADD COLUMN IF NOT EXISTS allowed_payment_methods TEXT[];

-- ── School Links: add grades list ────────────────────────────────────────────
ALTER TABLE school_links
  ADD COLUMN IF NOT EXISTS grades TEXT[],
  ADD COLUMN IF NOT EXISTS allowed_payment_methods TEXT[];

-- ── App Settings: personal order payment controls ────────────────────────────
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS personal_allowed_payment_methods TEXT[];

-- ── Orders: track company link + store resolved payment methods at submission ─
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS company_link_id UUID REFERENCES private_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_allowed_payment_methods TEXT[];

CREATE INDEX IF NOT EXISTS orders_company_link_id_idx ON orders(company_link_id);
