-- ============================================================
-- TEAM MEMBERS TABLE
-- ============================================================
-- Roles:
--   owner  → full access including team management
--   admin  → orders, schools, settings, reports (no team mgmt)
--   staff  → view & update orders only

CREATE TABLE IF NOT EXISTS team_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email      TEXT NOT NULL UNIQUE,
  full_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'staff'
               CHECK (role IN ('owner', 'admin', 'staff')),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON team_members(user_id);
CREATE INDEX IF NOT EXISTS team_members_email_idx   ON team_members(email);

-- updated_at trigger
DROP TRIGGER IF EXISTS team_members_updated_at ON team_members;
CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: service role bypasses everything; no public access needed
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members_owner_all" ON team_members;
CREATE POLICY "team_members_owner_all" ON team_members
  FOR ALL
  USING     ((select auth.jwt() ->> 'role') = 'authenticated')
  WITH CHECK ((select auth.jwt() ->> 'role') = 'authenticated');
