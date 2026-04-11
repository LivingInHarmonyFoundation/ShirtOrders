CREATE TABLE IF NOT EXISTS government_orgs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'government_orgs_updated_at') THEN
    CREATE TRIGGER government_orgs_updated_at
      BEFORE UPDATE ON government_orgs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE government_orgs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active gov orgs" ON government_orgs;
CREATE POLICY "Public can view active gov orgs"
  ON government_orgs FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated can insert gov orgs" ON government_orgs;
CREATE POLICY "Authenticated can insert gov orgs"
  ON government_orgs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update gov orgs" ON government_orgs;
CREATE POLICY "Authenticated can update gov orgs"
  ON government_orgs FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete gov orgs" ON government_orgs;
CREATE POLICY "Authenticated can delete gov orgs"
  ON government_orgs FOR DELETE TO authenticated USING (true);
