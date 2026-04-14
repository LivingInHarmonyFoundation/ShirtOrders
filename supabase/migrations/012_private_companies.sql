-- Private companies dropdown list for the order form

CREATE TABLE IF NOT EXISTS private_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'private_companies_updated_at') THEN
    CREATE TRIGGER private_companies_updated_at
      BEFORE UPDATE ON private_companies
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE private_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active private companies" ON private_companies;
CREATE POLICY "Public can view active private companies"
  ON private_companies FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated can insert private companies" ON private_companies;
CREATE POLICY "Authenticated can insert private companies"
  ON private_companies FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update private companies" ON private_companies;
CREATE POLICY "Authenticated can update private companies"
  ON private_companies FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can delete private companies" ON private_companies;
CREATE POLICY "Authenticated can delete private companies"
  ON private_companies FOR DELETE TO authenticated USING (true);
