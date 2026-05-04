/**
 * @file route.ts
 * @description Admin discount codes list and creation endpoint.
 * - GET: returns all discount codes ordered by created_at desc.
 * - POST: creates a new discount code; stores code uppercased.
 *
 * Both handlers require authentication and canManageSettings permission.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── GET /api/admin/discount-codes ───────────────────────────

/**
 * GET /api/admin/discount-codes — fetch all discount codes, newest first.
 * Requires canManageSettings permission.
 * Response: { discountCodes: DiscountCode[] }
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const admin = await createAdminClient()
  const { data: discountCodes, error } = await admin
    .from('discount_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching discount codes:', error)
    return NextResponse.json({ error: 'Failed to fetch discount codes' }, { status: 500 })
  }

  return NextResponse.json({ discountCodes: discountCodes || [] })
}

// ─── POST /api/admin/discount-codes ──────────────────────────

/**
 * POST /api/admin/discount-codes — create a new discount code.
 * Requires canManageSettings permission.
 * Body: { code: string, type: 'percentage'|'fixed', value: number, expires_at?: string, enabled?: boolean }
 * Code is stored uppercase. Validates required fields and constraints.
 * Response: { discountCode: DiscountCode }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { code, type, value, expires_at, enabled } = body

  // ─── Validation ───────────────────────────────────────────
  if (!code || typeof code !== 'string' || !code.trim()) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }
  if (!['percentage', 'fixed'].includes(type)) {
    return NextResponse.json({ error: 'Type must be percentage or fixed' }, { status: 400 })
  }
  const numValue = Number(value)
  if (!numValue || numValue <= 0) {
    return NextResponse.json({ error: 'Value must be greater than 0' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data: discountCode, error } = await admin
    .from('discount_codes')
    .insert({
      code: code.toUpperCase().trim(),
      type,
      value: numValue,
      expires_at: expires_at || null,
      enabled: enabled !== false,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A code with that name already exists' }, { status: 409 })
    }
    console.error('Error creating discount code:', error)
    return NextResponse.json({ error: 'Failed to create discount code' }, { status: 500 })
  }

  return NextResponse.json({ discountCode }, { status: 201 })
}
