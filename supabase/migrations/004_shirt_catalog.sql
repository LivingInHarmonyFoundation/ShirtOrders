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

-- Auto-update updated_at
CREATE TRIGGER shirt_catalog_updated_at
  BEFORE UPDATE ON shirt_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: public can read active items, only service role can write
ALTER TABLE shirt_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active shirt catalog"
  ON shirt_catalog FOR SELECT
  USING (is_active = true);

-- Storage bucket for shirt images
INSERT INTO storage.buckets (id, name, public)
VALUES ('shirt-images', 'shirt-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public to read images
CREATE POLICY "Public can view shirt images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shirt-images');

-- Allow authenticated users to upload/delete images
CREATE POLICY "Authenticated users can upload shirt images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'shirt-images');

CREATE POLICY "Authenticated users can delete shirt images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'shirt-images');
