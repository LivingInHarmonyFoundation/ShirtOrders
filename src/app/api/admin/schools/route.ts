/**
 * @file route.ts
 * @description School links collection endpoint. GET lists all school links with order
 * counts; POST creates a new school link with a unique slug (retried up to 5 times).
 * GET requires only authentication. POST requires the `canManageSchools` permission.
 * Uses `createAdminClient()` (bypasses RLS) for all DB reads and writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── Slug Generation ──────────────────────────────────────────

/**
 * Generate a URL-friendly slug from a school name.
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

// ─── GET /api/admin/schools ───────────────────────────────────

/**
 * GET /api/admin/schools — return all school links ordered by creation date descending,
 * each with a derived `order_count` field.
 * Auth-only (any authenticated admin user). No additional permission key required.
 * Uses createAdminClient() (bypasses RLS) to guarantee visibility of all rows.
 * Response: { schools: SchoolLink[] }
 */
export async function GET() {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Query & Data Fetching ───────────────────────────────────
  // createAdminClient() bypasses RLS — required to read school_links rows
  const admin = await createAdminClient()

  // Get schools with order counts
  const { data: schools, error } = await admin
    .from('school_links')
    .select('*, orders(count)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch schools' }, { status: 500 })

  // ─── Response Shaping ────────────────────────────────────────
  // Flatten Supabase aggregate into scalar order_count; expose only known fields
  const shaped = (schools || []).map((s) => ({
    id: s.id,
    school_name: s.school_name,
    slug: s.slug,
    is_active: s.is_active,
    grades: s.grades ?? null,
    allowed_payment_methods: s.allowed_payment_methods ?? null,
    created_at: s.created_at,
    order_count: Array.isArray(s.orders) ? (s.orders[0] as { count: number })?.count ?? 0 : 0,
  }))

  return NextResponse.json({ schools: shaped })
}

// ─── POST /api/admin/schools ──────────────────────────────────

/**
 * POST /api/admin/schools — create a new school link.
 * Requires authentication and the `canManageSchools` permission.
 * Slug generation is retried up to 5 times to guarantee uniqueness; returns 500 if all
 * attempts are exhausted.
 * Body: { school_name: string }
 * Response: { school: SchoolLink } with status 201.
 */
export async function POST(request: NextRequest) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSchools')
  if (auth instanceof NextResponse) return auth

  // ─── Input Validation ────────────────────────────────────────
  // createAdminClient() bypasses RLS — required to read and insert school_links rows
  const admin = await createAdminClient()
  const { school_name } = await request.json()

  if (!school_name?.trim()) {
    return NextResponse.json({ error: 'School name is required' }, { status: 400 })
  }

  // ─── Slug Generation (up to 5 retries) ───────────────────────
  // Try up to 5 times to get a unique slug
  let slug = ''
  for (let i = 0; i < 5; i++) {
    const candidate = generateSlug(school_name)
    const { data: existing } = await admin
      .from('school_links')
      .select('id')
      .eq('slug', candidate)
      .single()
    if (!existing) { slug = candidate; break }
  }

  if (!slug) return NextResponse.json({ error: 'Could not generate unique slug' }, { status: 500 })

  // ─── Insert ──────────────────────────────────────────────────
  const { data: school, error } = await admin
    .from('school_links')
    .insert({ school_name: school_name.trim(), slug })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create school link' }, { status: 500 })

  return NextResponse.json({ school }, { status: 201 })
}
