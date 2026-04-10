-- ============================================================
-- SCHOOL LINKS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS school_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS school_links_slug_idx   ON school_links(slug);
CREATE INDEX IF NOT EXISTS school_links_active_idx ON school_links(is_active);

-- Track which link generated each order (nullable)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS school_link_id UUID REFERENCES school_links(id) ON DELETE SET NULL;

-- RLS for school_links
ALTER TABLE school_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_links_public_select" ON school_links;
DROP POLICY IF EXISTS "school_links_admin_all"     ON school_links;

CREATE POLICY "school_links_public_select" ON school_links
  FOR SELECT USING (true);

CREATE POLICY "school_links_admin_all" ON school_links
  FOR ALL
  USING     ((select auth.jwt() ->> 'role') = 'authenticated')
  WITH CHECK ((select auth.jwt() ->> 'role') = 'authenticated');

-- ============================================================
-- SEED: SCHOOL LINKS
-- ============================================================

INSERT INTO school_links (id, school_name, slug, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Lincoln Elementary School', 'lincoln-elementary', true),
  ('a2000000-0000-0000-0000-000000000002', 'Roosevelt High School',     'roosevelt-high',     true),
  ('a3000000-0000-0000-0000-000000000003', 'Jefferson Middle School',   'jefferson-middle',   true),
  ('a4000000-0000-0000-0000-000000000004', 'Washington Academy',        'washington-academy', true),
  ('a5000000-0000-0000-0000-000000000005', 'Adams Primary School',      'adams-primary',      false)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SEED: SAMPLE ORDERS (25 rows, skip if orders already exist)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders LIMIT 1) THEN

    INSERT INTO orders (
      id, order_number, full_name, email, phone,
      institution_type, school_name, grade, classroom,
      organization_name, department_office,
      shirt_size, quantity, unit_price, total_amount,
      payment_status, order_status, delivery_status,
      stripe_payment_intent_id, stripe_checkout_session_id,
      date_submitted, date_paid, date_delivered,
      notes, admin_notes, created_at, updated_at, school_link_id
    ) VALUES

    -- 1 Lincoln Elementary, paid, completed, delivered
    (uuid_generate_v4(), 'ORD-20260110-0001', 'Maria Santos', 'maria.santos@lincoln.edu', '555-0101',
     'school', 'Lincoln Elementary School', 'Grade 3', 'Room 5',
     null, null,
     'M', 2, 15.00, 30.00,
     'paid', 'completed', 'delivered',
     'pi_sample_001', null,
     '2026-01-10 09:00:00+00', '2026-01-10 09:15:00+00', '2026-01-17 14:00:00+00',
     null, 'Delivered on schedule.', '2026-01-10 09:00:00+00', '2026-01-17 14:00:00+00',
     'a1000000-0000-0000-0000-000000000001'),

    -- 2 Government, paid, processing, not_delivered
    (uuid_generate_v4(), 'ORD-20260115-0002', 'Carlos Rivera', 'carlos.rivera@deped.gov', '555-0102',
     'government', null, null, null,
     'Department of Education', 'ICT Division',
     'L', 5, 15.00, 75.00,
     'paid', 'processing', 'not_delivered',
     'pi_sample_002', null,
     '2026-01-15 10:30:00+00', '2026-01-15 10:45:00+00', null,
     'Please deliver to Building A.', null, '2026-01-15 10:30:00+00', '2026-01-15 10:45:00+00',
     null),

    -- 3 Roosevelt High, paid, completed, delivered
    (uuid_generate_v4(), 'ORD-20260120-0003', 'Ana Reyes', 'ana.reyes@roosevelt.edu', null,
     'school', 'Roosevelt High School', 'Grade 10', 'Section A',
     null, null,
     'S', 1, 15.00, 15.00,
     'paid', 'completed', 'delivered',
     'pi_sample_003', null,
     '2026-01-20 08:00:00+00', '2026-01-20 08:10:00+00', '2026-01-27 11:00:00+00',
     null, null, '2026-01-20 08:00:00+00', '2026-01-27 11:00:00+00',
     'a2000000-0000-0000-0000-000000000002'),

    -- 4 Government, manual, ready, partially_delivered
    (uuid_generate_v4(), 'ORD-20260125-0004', 'Jose Garcia', 'jose.garcia@doh.gov', '555-0104',
     'government', null, null, null,
     'Department of Health', 'Administrative Office',
     'XL', 3, 15.00, 45.00,
     'manual', 'ready', 'partially_delivered',
     null, null,
     '2026-01-25 13:00:00+00', '2026-01-26 09:00:00+00', null,
     null, 'Paid via check #1042. Partial delivery made.', '2026-01-25 13:00:00+00', '2026-01-26 09:00:00+00',
     null),

    -- 5 Jefferson, paid, completed, delivered
    (uuid_generate_v4(), 'ORD-20260201-0005', 'Lisa Chen', 'lisa.chen@jefferson.edu', '555-0105',
     'school', 'Jefferson Middle School', 'Grade 7', 'Room 12',
     null, null,
     'XS', 1, 15.00, 15.00,
     'paid', 'completed', 'delivered',
     'pi_sample_005', null,
     '2026-02-01 07:30:00+00', '2026-02-01 07:45:00+00', '2026-02-08 10:00:00+00',
     null, null, '2026-02-01 07:30:00+00', '2026-02-08 10:00:00+00',
     'a3000000-0000-0000-0000-000000000003'),

    -- 6 Government, paid, completed, delivered
    (uuid_generate_v4(), 'ORD-20260205-0006', 'Mark Davis', 'mark.davis@cityhall.gov', '555-0106',
     'government', null, null, null,
     'Office of the City Mayor', 'Executive Office',
     'M', 4, 15.00, 60.00,
     'paid', 'completed', 'delivered',
     'pi_sample_006', null,
     '2026-02-05 11:00:00+00', '2026-02-05 11:20:00+00', '2026-02-12 15:00:00+00',
     null, null, '2026-02-05 11:00:00+00', '2026-02-12 15:00:00+00',
     null),

    -- 7 Lincoln, paid, processing, not_delivered
    (uuid_generate_v4(), 'ORD-20260210-0007', 'Sarah Kim', 'sarah.kim@lincoln.edu', null,
     'school', 'Lincoln Elementary School', 'Grade 5', 'Room 8',
     null, null,
     'L', 2, 15.00, 30.00,
     'paid', 'processing', 'not_delivered',
     'pi_sample_007', null,
     '2026-02-10 09:00:00+00', '2026-02-10 09:10:00+00', null,
     null, null, '2026-02-10 09:00:00+00', '2026-02-10 09:10:00+00',
     'a1000000-0000-0000-0000-000000000001'),

    -- 8 Government, pending, new, not_delivered
    (uuid_generate_v4(), 'ORD-20260215-0008', 'Tom Brown', 'tom.brown@dpwh.gov', '555-0108',
     'government', null, null, null,
     'DPWH Regional Office', 'Engineering Division',
     'XXL', 1, 15.00, 15.00,
     'pending', 'new', 'not_delivered',
     null, null,
     '2026-02-15 14:00:00+00', null, null,
     'XXL please check sizing chart.', null, '2026-02-15 14:00:00+00', '2026-02-15 14:00:00+00',
     null),

    -- 9 Washington Academy, paid, ready, not_delivered
    (uuid_generate_v4(), 'ORD-20260218-0009', 'Grace Lim', 'grace.lim@washington.edu', '555-0109',
     'school', 'Washington Academy', 'Grade 8', 'Section B',
     null, null,
     'M', 3, 15.00, 45.00,
     'paid', 'ready', 'not_delivered',
     'pi_sample_009', null,
     '2026-02-18 08:30:00+00', '2026-02-18 08:45:00+00', null,
     null, 'Ready for pickup.', '2026-02-18 08:30:00+00', '2026-02-18 08:45:00+00',
     'a4000000-0000-0000-0000-000000000004'),

    -- 10 Government, manual, completed, delivered
    (uuid_generate_v4(), 'ORD-20260222-0010', 'Robert Cruz', 'robert.cruz@deped.gov', '555-0110',
     'government', null, null, null,
     'DepEd Schools Division', 'Curriculum Division',
     'S', 2, 15.00, 30.00,
     'manual', 'completed', 'delivered',
     null, null,
     '2026-02-22 10:00:00+00', '2026-02-23 09:00:00+00', '2026-03-01 13:00:00+00',
     null, 'Cash payment received.', '2026-02-22 10:00:00+00', '2026-03-01 13:00:00+00',
     null),

    -- 11 Adams Primary, paid, processing, partially_delivered
    (uuid_generate_v4(), 'ORD-20260301-0011', 'Nina Flores', 'nina.flores@adams.edu', '555-0111',
     'school', 'Adams Primary School', 'Grade 2', 'Room 3',
     null, null,
     'XL', 2, 15.00, 30.00,
     'paid', 'processing', 'partially_delivered',
     'pi_sample_011', null,
     '2026-03-01 09:00:00+00', '2026-03-01 09:15:00+00', null,
     null, '1 of 2 delivered.', '2026-03-01 09:00:00+00', '2026-03-01 09:15:00+00',
     'a5000000-0000-0000-0000-000000000005'),

    -- 12 Government, paid, processing, not_delivered
    (uuid_generate_v4(), 'ORD-20260305-0012', 'Alex Tan', 'alex.tan@nbi.gov', null,
     'government', null, null, null,
     'NBI Regional Office', 'Operations Division',
     'M', 6, 15.00, 90.00,
     'paid', 'processing', 'not_delivered',
     'pi_sample_012', null,
     '2026-03-05 11:30:00+00', '2026-03-05 11:45:00+00', null,
     'Bulk order for team uniforms.', null, '2026-03-05 11:30:00+00', '2026-03-05 11:45:00+00',
     null),

    -- 13 Lincoln, paid, completed, delivered
    (uuid_generate_v4(), 'ORD-20260308-0013', 'Cathy Wong', 'cathy.wong@lincoln.edu', '555-0113',
     'school', 'Lincoln Elementary School', 'Grade 1', 'Room 2',
     null, null,
     'S', 1, 15.00, 15.00,
     'paid', 'completed', 'delivered',
     'pi_sample_013', null,
     '2026-03-08 07:00:00+00', '2026-03-08 07:10:00+00', '2026-03-15 12:00:00+00',
     null, null, '2026-03-08 07:00:00+00', '2026-03-15 12:00:00+00',
     'a1000000-0000-0000-0000-000000000001'),

    -- 14 Government, pending, new, not_delivered
    (uuid_generate_v4(), 'ORD-20260310-0014', 'James Lee', 'james.lee@pnp.gov', '555-0114',
     'government', null, null, null,
     'PNP District Office', 'Administration',
     'L', 4, 15.00, 60.00,
     'pending', 'new', 'not_delivered',
     null, null,
     '2026-03-10 13:00:00+00', null, null,
     null, null, '2026-03-10 13:00:00+00', '2026-03-10 13:00:00+00',
     null),

    -- 15 Roosevelt, paid, ready, not_delivered
    (uuid_generate_v4(), 'ORD-20260315-0015', 'Patricia Go', 'patricia.go@roosevelt.edu', null,
     'school', 'Roosevelt High School', 'Grade 11', 'Section C',
     null, null,
     'M', 2, 15.00, 30.00,
     'paid', 'ready', 'not_delivered',
     'pi_sample_015', null,
     '2026-03-15 08:00:00+00', '2026-03-15 08:15:00+00', null,
     null, 'Ready for school pickup day.', '2026-03-15 08:00:00+00', '2026-03-15 08:15:00+00',
     'a2000000-0000-0000-0000-000000000002'),

    -- 16 Government, manual, processing, partially_delivered
    (uuid_generate_v4(), 'ORD-20260318-0016', 'Michael Sy', 'michael.sy@bfp.gov', '555-0116',
     'government', null, null, null,
     'BFP Fire Station 4', 'Administrative Section',
     'XL', 3, 15.00, 45.00,
     'manual', 'processing', 'partially_delivered',
     null, null,
     '2026-03-18 10:00:00+00', '2026-03-19 09:00:00+00', null,
     null, 'Check payment #2087. 2 of 3 delivered.', '2026-03-18 10:00:00+00', '2026-03-19 09:00:00+00',
     null),

    -- 17 Jefferson, paid, completed, delivered
    (uuid_generate_v4(), 'ORD-20260322-0017', 'Jenny Lim', 'jenny.lim@jefferson.edu', '555-0117',
     'school', 'Jefferson Middle School', 'Grade 9', 'Room 14',
     null, null,
     'XXL', 1, 15.00, 15.00,
     'paid', 'completed', 'delivered',
     'pi_sample_017', null,
     '2026-03-22 09:30:00+00', '2026-03-22 09:45:00+00', '2026-03-29 14:00:00+00',
     null, null, '2026-03-22 09:30:00+00', '2026-03-29 14:00:00+00',
     'a3000000-0000-0000-0000-000000000003'),

    -- 18 Government, paid, processing, not_delivered
    (uuid_generate_v4(), 'ORD-20260325-0018', 'Ryan Ong', 'ryan.ong@dfa.gov', null,
     'government', null, null, null,
     'DFA Consular Office', 'Passport Division',
     'M', 5, 15.00, 75.00,
     'paid', 'processing', 'not_delivered',
     'pi_sample_018', null,
     '2026-03-25 11:00:00+00', '2026-03-25 11:20:00+00', null,
     'For consular staff.', null, '2026-03-25 11:00:00+00', '2026-03-25 11:20:00+00',
     null),

    -- 19 Washington, pending, new, not_delivered
    (uuid_generate_v4(), 'ORD-20260328-0019', 'Lucy Yap', 'lucy.yap@washington.edu', '555-0119',
     'school', 'Washington Academy', 'Grade 6', 'Room 7',
     null, null,
     'S', 2, 15.00, 30.00,
     'pending', 'new', 'not_delivered',
     null, null,
     '2026-03-28 08:00:00+00', null, null,
     null, null, '2026-03-28 08:00:00+00', '2026-03-28 08:00:00+00',
     'a4000000-0000-0000-0000-000000000004'),

    -- 20 Government, failed, cancelled, not_delivered
    (uuid_generate_v4(), 'ORD-20260330-0020', 'Kevin Tan', 'kevin.tan@ltfrb.gov', '555-0120',
     'government', null, null, null,
     'LTFRB Regional Office', 'Legal Division',
     'L', 2, 15.00, 30.00,
     'failed', 'cancelled', 'not_delivered',
     null, null,
     '2026-03-30 14:00:00+00', null, null,
     null, 'Card declined. Contacted customer.', '2026-03-30 14:00:00+00', '2026-03-30 14:00:00+00',
     null),

    -- 21 Adams, paid, ready, not_delivered
    (uuid_generate_v4(), 'ORD-20260401-0021', 'Diana Ramos', 'diana.ramos@adams.edu', null,
     'school', 'Adams Primary School', 'Grade 4', 'Room 9',
     null, null,
     'M', 3, 15.00, 45.00,
     'paid', 'ready', 'not_delivered',
     'pi_sample_021', null,
     '2026-04-01 09:00:00+00', '2026-04-01 09:15:00+00', null,
     null, 'Ready for distribution.', '2026-04-01 09:00:00+00', '2026-04-01 09:15:00+00',
     'a5000000-0000-0000-0000-000000000005'),

    -- 22 Government, pending, new, not_delivered
    (uuid_generate_v4(), 'ORD-20260403-0022', 'Brian Santos', 'brian.santos@bsp.gov', '555-0122',
     'government', null, null, null,
     'BSP Regional Branch', 'Currency Management',
     'XL', 1, 15.00, 15.00,
     'pending', 'new', 'not_delivered',
     null, null,
     '2026-04-03 10:30:00+00', null, null,
     null, null, '2026-04-03 10:30:00+00', '2026-04-03 10:30:00+00',
     null),

    -- 23 Lincoln, paid, processing, not_delivered
    (uuid_generate_v4(), 'ORD-20260405-0023', 'Anna Cruz', 'anna.cruz@lincoln.edu', '555-0123',
     'school', 'Lincoln Elementary School', 'Grade 6', 'Room 11',
     null, null,
     'S', 4, 15.00, 60.00,
     'paid', 'processing', 'not_delivered',
     'pi_sample_023', null,
     '2026-04-05 08:00:00+00', '2026-04-05 08:20:00+00', null,
     'For science club members.', null, '2026-04-05 08:00:00+00', '2026-04-05 08:20:00+00',
     'a1000000-0000-0000-0000-000000000001'),

    -- 24 Government, manual, ready, partially_delivered
    (uuid_generate_v4(), 'ORD-20260407-0024', 'Paul Garcia', 'paul.garcia@bi.gov', '555-0124',
     'government', null, null, null,
     'Bureau of Immigration', 'Intelligence Division',
     'M', 2, 15.00, 30.00,
     'manual', 'ready', 'partially_delivered',
     null, null,
     '2026-04-07 11:00:00+00', '2026-04-07 14:00:00+00', null,
     null, 'Cash payment. 1 ready, 1 pending.', '2026-04-07 11:00:00+00', '2026-04-07 14:00:00+00',
     null),

    -- 25 Roosevelt, paid, new, not_delivered
    (uuid_generate_v4(), 'ORD-20260409-0025', 'May Santos', 'may.santos@roosevelt.edu', null,
     'school', 'Roosevelt High School', 'Grade 12', 'Section D',
     null, null,
     'L', 1, 15.00, 15.00,
     'paid', 'new', 'not_delivered',
     'pi_sample_025', null,
     '2026-04-09 09:00:00+00', '2026-04-09 09:10:00+00', null,
     null, null, '2026-04-09 09:00:00+00', '2026-04-09 09:10:00+00',
     'a2000000-0000-0000-0000-000000000002');

  END IF;
END $$;
