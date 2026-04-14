-- Add mission_banner_url to app_settings
-- Stores the public URL of an uploaded banner image shown in the
-- "Our Mission" section on the public landing page.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS mission_banner_url TEXT DEFAULT NULL;
