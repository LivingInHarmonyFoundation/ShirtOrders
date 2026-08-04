-- ─────────────────────────────────────────────────────────────────────────────
-- 037_municipalities.sql
-- New "municipality" institution type: customers ordering on behalf of a
-- Puerto Rico municipio pick it from an admin-managed dropdown. The selected
-- municipio is stored in orders.organization_name (mirroring how government
-- orders store their agency). Seeds all 78 PR municipalities.
-- RLS mirrors government_orgs post-hardening: public can read active rows;
-- writes go through the service role only (admin API routes).
-- ─────────────────────────────────────────────────────────────────────────────

-- Allow the new institution_type value (same pattern as 031_staff)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_institution_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_institution_type_check
  CHECK (institution_type IN ('school', 'government', 'personal', 'private_company', 'staff', 'municipality'));

-- Admin toggle to enable/disable municipio orders (on by default)
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS municipality_orders_enabled BOOLEAN NOT NULL DEFAULT true;

-- Admin-managed list of municipios shown in the order-form dropdown
CREATE TABLE IF NOT EXISTS municipalities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'municipalities_updated_at') THEN
    CREATE TRIGGER municipalities_updated_at
      BEFORE UPDATE ON municipalities
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active municipalities" ON municipalities;
CREATE POLICY "Public can view active municipalities"
  ON municipalities FOR SELECT
  USING (is_active = true);

-- Seed: the 78 municipios of Puerto Rico
INSERT INTO municipalities (name) VALUES
  ('Adjuntas'), ('Aguada'), ('Aguadilla'), ('Aguas Buenas'), ('Aibonito'),
  ('Añasco'), ('Arecibo'), ('Arroyo'), ('Barceloneta'), ('Barranquitas'),
  ('Bayamón'), ('Cabo Rojo'), ('Caguas'), ('Camuy'), ('Canóvanas'),
  ('Carolina'), ('Cataño'), ('Cayey'), ('Ceiba'), ('Ciales'),
  ('Cidra'), ('Coamo'), ('Comerío'), ('Corozal'), ('Culebra'),
  ('Dorado'), ('Fajardo'), ('Florida'), ('Guánica'), ('Guayama'),
  ('Guayanilla'), ('Guaynabo'), ('Gurabo'), ('Hatillo'), ('Hormigueros'),
  ('Humacao'), ('Isabela'), ('Jayuya'), ('Juana Díaz'), ('Juncos'),
  ('Lajas'), ('Lares'), ('Las Marías'), ('Las Piedras'), ('Loíza'),
  ('Luquillo'), ('Manatí'), ('Maricao'), ('Maunabo'), ('Mayagüez'),
  ('Moca'), ('Morovis'), ('Naguabo'), ('Naranjito'), ('Orocovis'),
  ('Patillas'), ('Peñuelas'), ('Ponce'), ('Quebradillas'), ('Rincón'),
  ('Río Grande'), ('Sabana Grande'), ('Salinas'), ('San Germán'), ('San Juan'),
  ('San Lorenzo'), ('San Sebastián'), ('Santa Isabel'), ('Toa Alta'), ('Toa Baja'),
  ('Trujillo Alto'), ('Utuado'), ('Vega Alta'), ('Vega Baja'), ('Vieques'),
  ('Villalba'), ('Yabucoa'), ('Yauco')
ON CONFLICT (name) DO NOTHING;
