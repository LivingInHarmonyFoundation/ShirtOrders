/**
 * @file route.ts
 * @description Private companies collection endpoint. GET lists all companies with order
 * counts; POST creates a new company with a case-insensitive duplicate name check and a
 * unique slug (retried up to 5 times). GET requires only authentication. POST additionally
 * requires the `canManageSettings` permission. Uses `createAdminClient()` (bypasses RLS)
 * for all DB reads and writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── Slug Generation ──────────────────────────────────────────

/**
 * Generate a URL-friendly slug from a company name.
 * Lowercases the name, strips non-alphanumeric characters, collapses spaces to hyphens,
 * truncates to 40 characters, and appends a 4-character random suffix for uniqueness.
 * The caller must still verify the slug is not already taken in the DB.
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base}-${suffix}`
}

// ─── GET /api/admin/private-companies ────────────────────────

/**
 * GET /api/admin/private-companies — return all private companies ordered by name,
 * each with a derived `order_count` field.
 * Auth-only (any authenticated admin user). No additional permission key required.
 * Uses createAdminClient() (bypasses RLS) to guarantee visibility of all rows.
 * The raw `orders` aggregate key is stripped from the response; only `order_count` is kept.
 * Response: { companies: PrivateCompany[] }
 */
export async function GET() {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Query & Data Fetching ───────────────────────────────────
  // createAdminClient() bypasses RLS — required to read private_companies rows
  const admin = await createAdminClient()
  const { data: companies, error } = await admin
    .from('private_companies')
    .select('*, orders(count)')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })

  // ─── Response Shaping ────────────────────────────────────────
  // Flatten Supabase aggregate into scalar order_count and remove the raw orders key
  const shaped = (companies || []).map((c) => ({
    ...c,
    order_count: Array.isArray(c.orders) ? (c.orders[0] as { count: number })?.count ?? 0 : 0,
    orders: undefined,
  }))

  return NextResponse.json({ companies: shaped })
}

// ─── POST /api/admin/private-companies ───────────────────────

/**
 * POST /api/admin/private-companies — create a new private company.
 * Requires authentication and the `canManageSettings` permission.
 * Performs a case-insensitive duplicate name check (ilike) before insertion; returns 409
 * if the name already exists.
 * Slug generation is retried up to 5 times to guarantee uniqueness; returns 500 if all
 * attempts are exhausted.
 * Body: { name: string }
 * Response: { company: PrivateCompany } with status 201, including order_count: 0.
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
  if (!name?.trim()) return NextResponse.json({ error: 'Company name is required' }, { status: 400 })

  // ─── Duplicate Check ─────────────────────────────────────────
  // createAdminClient() bypasses RLS — required to read and insert private_companies rows
  const admin = await createAdminClient()

  // Case-insensitive duplicate detection prevents near-identical company names
  const { data: existing } = await admin
    .from('private_companies')
    .select('id')
    .ilike('name', name.trim())
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'This company already exists' }, { status: 409 })

  // ─── Slug Generation (up to 5 retries) ───────────────────────
  // Try up to 5 times to get a unique slug
  let slug = ''
  for (let i = 0; i < 5; i++) {
    const candidate = generateSlug(name.trim())
    const { data: taken } = await admin
      .from('private_companies')
      .select('id')
      .eq('slug', candidate)
      .single()
    if (!taken) { slug = candidate; break }
  }
  if (!slug) return NextResponse.json({ error: 'Could not generate unique slug' }, { status: 500 })

  // ─── Insert ──────────────────────────────────────────────────
  const { data, error } = await admin
    .from('private_companies')
    .insert({ name: name.trim(), slug })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create company' }, { status: 500 })
  return NextResponse.json({ company: { ...data, order_count: 0 } }, { status: 201 })
}
