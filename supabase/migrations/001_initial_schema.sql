-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_name TEXT NOT NULL DEFAULT 'Institution Shirt Order Manager',
  logo_url TEXT,
  shirt_price DECIMAL(10,2) NOT NULL DEFAULT 15.00,
  available_sizes TEXT[] NOT NULL DEFAULT ARRAY['XS','S','M','L','XL','XXL','XXXL'],
  school_orders_enabled BOOLEAN NOT NULL DEFAULT true,
  government_orders_enabled BOOLEAN NOT NULL DEFAULT true,
  manual_payment_enabled BOOLEAN NOT NULL DEFAULT true,
  confirmation_message TEXT NOT NULL DEFAULT 'Thank you for your order! We will process it shortly.',
  admin_email TEXT,
  email_notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings only if the table is emptyn
INSERT INTO app_settings (id)
SELECT uuid_generate_v4()
WHERE NOT EXISTS (SELECT 1 FROM app_settings LIMIT 1);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  institution_type TEXT NOT NULL CHECK (institution_type IN ('school', 'government')),
  school_name TEXT,
  grade TEXT,
  classroom TEXT,
  organization_name TEXT,
  department_office TEXT,
  shirt_size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'manual')),
  order_status TEXT NOT NULL DEFAULT 'new'
    CHECK (order_status IN ('new', 'processing', 'ready', 'completed', 'cancelled')),
  delivery_status TEXT NOT NULL DEFAULT 'not_delivered'
    CHECK (delivery_status IN ('not_delivered', 'partially_delivered', 'delivered')),
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  date_submitted TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_paid TIMESTAMPTZ,
  date_delivered TIMESTAMPTZ,
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT NOT NULL DEFAULT 'system',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS orders_email_idx            ON orders(email);
CREATE INDEX IF NOT EXISTS orders_order_number_idx     ON orders(order_number);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx   ON orders(payment_status);
CREATE INDEX IF NOT EXISTS orders_order_status_idx     ON orders(order_status);
CREATE INDEX IF NOT EXISTS orders_delivery_status_idx  ON orders(delivery_status);
CREATE INDEX IF NOT EXISTS orders_institution_type_idx ON orders(institution_type);
CREATE INDEX IF NOT EXISTS orders_created_at_idx       ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_stripe_session_idx   ON orders(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS audit_logs_order_id_idx     ON audit_logs(order_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop before re-creating so the migration is safe to run multiple times
DROP TRIGGER IF EXISTS orders_updated_at      ON orders;
DROP TRIGGER IF EXISTS app_settings_updated_at ON app_settings;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs   ENABLE ROW LEVEL SECURITY;

-- Drop all policies first so re-runs don't fail
DROP POLICY IF EXISTS "orders_public_insert"   ON orders;
DROP POLICY IF EXISTS "orders_public_select"   ON orders;
DROP POLICY IF EXISTS "orders_admin_all"       ON orders;
DROP POLICY IF EXISTS "settings_public_select" ON app_settings;
DROP POLICY IF EXISTS "settings_admin_all"     ON app_settings;
DROP POLICY IF EXISTS "audit_logs_admin_all"   ON audit_logs;

-- orders: anyone can read (needed for confirmation page via anon key)
CREATE POLICY "orders_public_select" ON orders
  FOR SELECT USING (true);

-- orders: anyone can insert (order form submission)
CREATE POLICY "orders_public_insert" ON orders
  FOR INSERT WITH CHECK (true);

-- orders: authenticated users (admins) can do everything
CREATE POLICY "orders_admin_all" ON orders
  FOR ALL
  USING     ((select auth.jwt() ->> 'role') = 'authenticated')
  WITH CHECK ((select auth.jwt() ->> 'role') = 'authenticated');

-- settings: anyone can read (needed to load form config)
CREATE POLICY "settings_public_select" ON app_settings
  FOR SELECT USING (true);

-- settings: authenticated users (admins) can update
CREATE POLICY "settings_admin_all" ON app_settings
  FOR ALL
  USING     ((select auth.jwt() ->> 'role') = 'authenticated')
  WITH CHECK ((select auth.jwt() ->> 'role') = 'authenticated');

-- audit_logs: authenticated users (admins) only
CREATE POLICY "audit_logs_admin_all" ON audit_logs
  FOR ALL
  USING     ((select auth.jwt() ->> 'role') = 'authenticated')
  WITH CHECK ((select auth.jwt() ->> 'role') = 'authenticated');
