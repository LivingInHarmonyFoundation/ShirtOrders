/**
 * @file route.ts
 * @description Government organizations collection endpoint. GET lists all orgs ordered
 * alphabetically; POST creates a new org with a case-insensitive duplicate name check.
 * GET requires only authentication. POST additionally requires the `canManageSettings`
 * permission. Uses `createAdminClient()` (bypasses RLS) for all DB reads and writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── GET /api/admin/government-orgs ──────────────────────────

/**
 * GET /api/admin/government-orgs — return all government organizations ordered by name.
 * Auth-only (any authenticated admin user). No additional permission key required.
 * Uses createAdminClient() (bypasses RLS) to guarantee visibility of all rows.
 * Response: { orgs: GovernmentOrg[] }
 */
export async function GET() {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Query & Data Fetching ───────────────────────────────────
  // createAdminClient() bypasses RLS — required to read government_orgs rows
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('government_orgs')
    .select('*')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  return NextResponse.json({ orgs: data || [] })
}

// ─── POST /api/admin/government-orgs ─────────────────────────

/**
 * POST /api/admin/government-orgs — create a new government organization.
 * Requires authentication and the `canManageSettings` permission.
 * A case-insensitive name uniqueness check (ilike) is performed before insertion;
 * returns 409 if the name already exists.
 * Body: { name: string }
 * Response: { org: GovernmentOrg } with status 201.
 */
export async function POST(request: NextRequest) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  // ─── Input Validation ────────────────────────────────────────
  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })

  // ─── Duplicate Check ─────────────────────────────────────────
  // createAdminClient() bypasses RLS — required to read and insert government_orgs rows
  const admin = await createAdminClient()

  // Case-insensitive duplicate detection prevents near-identical org names
  const { data: existing } = await admin
    .from('government_orgs')
    .select('id')
    .ilike('name', name.trim())
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'This organization already exists' }, { status: 409 })

  // ─── Insert ──────────────────────────────────────────────────
  const { data, error } = await admin
    .from('government_orgs')
    .insert({ name: name.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
  return NextResponse.json({ org: data }, { status: 201 })
}
