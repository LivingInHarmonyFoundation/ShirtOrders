/**
 * @file route.ts
 * @description Municipalities collection endpoint (admin). GET lists all municipios
 * ordered alphabetically; POST creates a new one with a case-insensitive duplicate
 * name check. GET requires only authentication; POST additionally requires the
 * `canManageSettings` permission. Mirrors /api/admin/government-orgs.
 * Uses `createAdminClient()` (bypasses RLS) for all DB reads and writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── GET /api/admin/municipalities ───────────────────────────

/**
 * GET /api/admin/municipalities — return ALL municipios (active and inactive).
 * Auth-only (any authenticated admin user).
 * Response: { municipalities: Municipality[] }
 */
export async function GET() {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Query & Data Fetching ───────────────────────────────────
  // createAdminClient() bypasses RLS — required to read inactive rows too
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('municipalities')
    .select('*')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch municipalities' }, { status: 500 })
  return NextResponse.json({ municipalities: data || [] })
}

// ─── POST /api/admin/municipalities ──────────────────────────

/**
 * POST /api/admin/municipalities — create a new municipio.
 * Requires authentication and the `canManageSettings` permission.
 * A case-insensitive duplicate check (ilike) returns 409 if the name exists.
 * Body: { name: string }
 * Response: { municipality: Municipality } with status 201.
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
  if (!name?.trim()) return NextResponse.json({ error: 'Municipio name is required' }, { status: 400 })

  // ─── Duplicate Check ─────────────────────────────────────────
  const admin = await createAdminClient()
  const { data: existing } = await admin
    .from('municipalities')
    .select('id')
    .ilike('name', name.trim())
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'This municipio already exists' }, { status: 409 })

  // ─── Insert ──────────────────────────────────────────────────
  const { data, error } = await admin
    .from('municipalities')
    .insert({ name: name.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create municipio' }, { status: 500 })
  return NextResponse.json({ municipality: data }, { status: 201 })
}
