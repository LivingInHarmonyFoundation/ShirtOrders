-- 017_catalog_back_image.sql
-- Add back image support to shirt catalog items

ALTER TABLE shirt_catalog
  ADD COLUMN IF NOT EXISTS back_image_url TEXT;
