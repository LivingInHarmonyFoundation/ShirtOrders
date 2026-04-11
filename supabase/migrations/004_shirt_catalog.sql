-- Shirt catalog for displaying available shirts on the home page
CREATE TABLE IF NOT EXISTS shirt_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at (only create trigger if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'shirt_catalog_updated_at'
  ) THEN
    CREATE TRIGGER shirt_catalog_updated_at
      BEFORE UPDATE ON shirt_catalog
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS: public can read active items
ALTER TABLE shirt_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active shirt catalog" ON shirt_catalog;
CREATE POLICY "Public can view active shirt catalog"
  ON shirt_catalog FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated can insert shirt catalog" ON shirt_catalog;
CREATE POLICY "Authenticated can insert shirt catalog"
  ON shirt_catalog FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update shirt catalog" ON shirt_catalog;
CREATE POLICY "Authenticated can update shirt catalog"
  ON shirt_catalog FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can delete shirt catalog" ON shirt_catalog;
CREATE POLICY "Authenticated can delete shirt catalog"
  ON shirt_catalog FOR DELETE
  TO authenticated
  USING (true);

-- Storage bucket for shirt images (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('shirt-images', 'shirt-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Public can view shirt images" ON storage.objects;
CREATE POLICY "Public can view shirt images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shirt-images');

DROP POLICY IF EXISTS "Authenticated users can upload shirt images" ON storage.objects;
CREATE POLICY "Authenticated users can upload shirt images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'shirt-images');

DROP POLICY IF EXISTS "Authenticated users can delete shirt images" ON storage.objects;
CREATE POLICY "Authenticated users can delete shirt images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'shirt-images');
