-- Campaigns: group orders into named events with start/end dates

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  ended_message TEXT NOT NULL DEFAULT 'This campaign has ended. Thank you for your participation.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'campaigns_updated_at') THEN
    CREATE TRIGGER campaigns_updated_at
      BEFORE UPDATE ON campaigns
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active campaigns" ON campaigns;
CREATE POLICY "Public can view active campaigns"
  ON campaigns FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Authenticated can manage campaigns" ON campaigns;
CREATE POLICY "Authenticated can manage campaigns"
  ON campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Link orders to campaigns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_campaign_id_idx ON orders(campaign_id);
