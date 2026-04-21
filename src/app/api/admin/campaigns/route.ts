/**
 * @file route.ts
 * @description Campaign collection endpoint. GET lists all campaigns with order counts;
 * POST creates a new (inactive) campaign. Both handlers require authentication.
 * POST additionally requires the `canManageSettings` permission. Uses
 * `createAdminClient()` (bypasses RLS) for all DB reads and writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── GET /api/admin/campaigns ─────────────────────────────────

/**
 * GET /api/admin/campaigns — return all campaigns ordered by creation date descending.
 * Auth-only (any authenticated admin user). No permission key required beyond a valid session.
 * Response shape: { campaigns: Campaign[] } where each campaign includes a derived
 * `order_count` field computed from the related `orders` aggregate.
 */
export async function GET() {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Query & Data Fetching ───────────────────────────────────
  // createAdminClient() bypasses RLS — required to read campaigns regardless of row policies
  const admin = await createAdminClient()

  // Get campaigns with order counts
  const { data, error } = await admin
    .from('campaigns')
    .select('*, orders(count)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })

  // ─── Response Shaping ────────────────────────────────────────
  // Flatten the Supabase aggregate array into a scalar order_count field
  const campaigns = (data || []).map(c => ({
    id: c.id,
    name: c.name,
    description: c.description,
    start_date: c.start_date,
    end_date: c.end_date,
    is_active: c.is_active,
    ended_message: c.ended_message,
    created_at: c.created_at,
    updated_at: c.updated_at,
    order_count: Array.isArray(c.orders) ? (c.orders[0] as { count: number })?.count ?? 0 : 0,
  }))

  return NextResponse.json({ campaigns })
}

// ─── POST /api/admin/campaigns ────────────────────────────────

/**
 * POST /api/admin/campaigns — create a new campaign (always starts inactive).
 * Requires authentication and the `canManageSettings` permission.
 * Body: { name, description?, start_date?, end_date?, ended_message? }
 * Response: { campaign: Campaign } with status 201.
 */
export async function POST(request: NextRequest) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  // ─── Input Validation ────────────────────────────────────────
  const admin = await createAdminClient()
  const body = await request.json()

  const { name, description, start_date, end_date, ended_message } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 })

  // ─── Insert ──────────────────────────────────────────────────
  // New campaigns are always created with is_active: false; activation is a separate PATCH
  const { data, error } = await admin
    .from('campaigns')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      start_date: start_date || null,
      end_date: end_date || null,
      ended_message: ended_message?.trim() || 'This campaign has ended. Thank you for your participation.',
      is_active: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
  return NextResponse.json({ campaign: { ...data, order_count: 0 } }, { status: 201 })
}
