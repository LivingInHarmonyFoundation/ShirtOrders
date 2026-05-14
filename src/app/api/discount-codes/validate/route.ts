/**
 * @file route.ts
 * @description Public endpoint for validating a discount code at checkout.
 * No authentication required — any customer can validate a code.
 *
 * Key invariants:
 * - Looks up by UPPER(code) for case-insensitive matching using ilike.
 * - Returns 404 if code not found, 400 if disabled or expired, 200 with discount data if valid.
 * - Does NOT apply the discount; that is done via PATCH /api/orders/[id]/discount.
 * - Uses createAdminClient() to bypass RLS since no user session is present.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// ─── POST /api/discount-codes/validate ───────────────────────

/**
 * POST /api/discount-codes/validate — validate a discount code.
 * Public endpoint — no auth required.
 * Body: { code: string }
 * Response (200): { discount: { id, code, type, value, expires_at } }
 * Response (400): { error: 'Code is disabled' | 'Code has expired' }
 * Response (404): { error: 'Discount code not found' }
 */
export async function POST(request: NextRequest) {
  const { code } = await request.json()

  if (!code || typeof code !== 'string' || !code.trim()) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  const admin = await createAdminClient()

  const { data: discountCode, error } = await admin
    .from('discount_codes')
    .select('id, code, type, value, expires_at, enabled, max_uses, restricted_to_type, restricted_to_name')
    .ilike('code', code.trim())
    .maybeSingle()

  if (error) {
    console.error('Error validating discount code:', error)
    return NextResponse.json({ error: 'Failed to validate code' }, { status: 500 })
  }

  if (!discountCode) {
    return NextResponse.json({ error: 'Discount code not found' }, { status: 404 })
  }

  if (!discountCode.enabled) {
    return NextResponse.json({ error: 'Code is disabled' }, { status: 400 })
  }

  if (discountCode.expires_at && new Date(discountCode.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Code has expired' }, { status: 400 })
  }

  if (discountCode.max_uses != null) {
    const { count } = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('discount_code', discountCode.code)
      .in('payment_status', ['paid', 'manual'])

    if ((count ?? 0) >= discountCode.max_uses) {
      return NextResponse.json({ error: 'This code has reached its usage limit' }, { status: 400 })
    }
  }

  return NextResponse.json({
    discount: {
      id: discountCode.id,
      code: discountCode.code,
      type: discountCode.type,
      value: discountCode.value,
      expires_at: discountCode.expires_at,
      restricted_to_type: discountCode.restricted_to_type,
      restricted_to_name: discountCode.restricted_to_name,
    },
  })
}
