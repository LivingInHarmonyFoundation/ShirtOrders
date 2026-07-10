-- ============================================================================
-- 032_rls_hardening.sql
--
-- Closes a critical data-exposure gap: several tables had RLS policies of
-- USING (true) or "auth.role() = 'authenticated'", which let anyone with the
-- public anon key (shipped in the browser bundle) read customer PII directly
-- via the Supabase REST API, and let any logged-in staff member write
-- privileged tables — bypassing the app-layer requirePermission() checks.
--
-- Every server-side path in this app uses the service-role client
-- (createAdminClient), which bypasses RLS. So the correct posture is
-- "service-role only" (RLS enabled, no permissive policies) on all sensitive
-- tables. Genuinely public catalog data keeps a narrow is_active = true read.
--
-- NOTE: policy names below are the ones that actually existed on the production
-- database (which was hand-edited via the dashboard and diverged from the names
-- in migrations 001/003). This migration was applied directly via the Supabase
-- Management API on 2026-07-10; the remote migration-tracking table is empty, so
-- this file documents what was applied rather than being replayed by the CLI.
-- ============================================================================

BEGIN;

-- ── orders — "Public can view own order" was USING (true): the PII leak.
DROP POLICY IF EXISTS "Public can view own order"           ON orders;
DROP POLICY IF EXISTS "Public can insert orders"            ON orders;
DROP POLICY IF EXISTS "Admins can do everything with orders" ON orders;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ── app_settings — "Public can read settings" USING (true): leaked admin_phone.
DROP POLICY IF EXISTS "Public can read settings"   ON app_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON app_settings;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ── audit_logs — authenticated-writable.
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ── team_members — was "authenticated" = any login could self-escalate to owner.
DROP POLICY IF EXISTS "team_members_owner_all" ON team_members;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- ── Tables that never had RLS enabled (readable/writable anonymously).
ALTER TABLE order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_catalog_items ENABLE ROW LEVEL SECURITY;

-- ── Lower-sensitivity tables kept their "public view active rows" SELECT policy
--    (genuinely public catalog data). Their authenticated-write policies were
--    removed so writes only happen server-side via the service-role client.
DROP POLICY IF EXISTS "school_links_admin_all"                    ON school_links;
DROP POLICY IF EXISTS "Authenticated can insert shirt catalog"    ON shirt_catalog;
DROP POLICY IF EXISTS "Authenticated can update shirt catalog"    ON shirt_catalog;
DROP POLICY IF EXISTS "Authenticated can delete shirt catalog"    ON shirt_catalog;
DROP POLICY IF EXISTS "Authenticated can insert gov orgs"         ON government_orgs;
DROP POLICY IF EXISTS "Authenticated can update gov orgs"         ON government_orgs;
DROP POLICY IF EXISTS "Authenticated can delete gov orgs"         ON government_orgs;
DROP POLICY IF EXISTS "Authenticated can insert private companies" ON private_companies;
DROP POLICY IF EXISTS "Authenticated can update private companies" ON private_companies;
DROP POLICY IF EXISTS "Authenticated can delete private companies" ON private_companies;
DROP POLICY IF EXISTS "Authenticated can manage campaigns"        ON campaigns;

COMMIT;
