ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS admin_phone TEXT,
  ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN NOT NULL DEFAULT false;
