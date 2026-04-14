-- Add badge_url column to app_settings
-- Controls the circular badge image shown on the public landing page
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS badge_url TEXT;
