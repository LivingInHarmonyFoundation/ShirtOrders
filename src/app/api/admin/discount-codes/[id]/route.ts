/**
 * @file route.ts
 * @description Admin discount code update and deletion by ID.
 * - PATCH: partial update of any discount code fields; code is always stored uppercase.
 * - DELETE: removes the discount code by id.
 *
 * Both handlers require authentication and canManageSettings permission.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── PATCH /api/admin/discount-codes/[id] ────────────────────

/**
 * PATCH /api/admin/discount-codes/[id] — partial update of a discount code.
 * Requires canManageSettings permission.
 * Body: any subset of { code, type, value, expires_at, enabled }
 * Code is stored uppercase if provided.
 * Response: { discountCode: DiscountCode }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const updateData: Record<string, unknown> = {}

  if ('code' in body) {
    const code = body.code
    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ error: 'Code cannot be empty' }, { status: 400 })
    }
    updateData.code = code.toUpperCase().trim()
  }

  if ('type' in body) {
    if (!['percentage', 'fixed'].includes(body.type)) {
      return NextResponse.json({ error: 'Type must be percentage or fixed' }, { status: 400 })
    }
    updateData.type = body.type
  }

  if ('value' in body) {
    const numValue = Number(body.value)
    if (!numValue || numValue <= 0) {
      return NextResponse.json({ error: 'Value must be greater than 0' }, { status: 400 })
    }
    updateData.value = numValue
  }

  if ('expires_at' in body) {
    updateData.expires_at = body.expires_at || null
  }

  if ('enabled' in body) {
    updateData.enabled = Boolean(body.enabled)
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  updateData.updated_at = new Date().toISOString()

  const admin = await createAdminClient()
  const { data: discountCode, error } = await admin
    .from('discount_codes')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A code with that name already exists' }, { status: 409 })
    }
    console.error('Error updating discount code:', error)
    return NextResponse.json({ error: 'Failed to update discount code' }, { status: 500 })
  }

  return NextResponse.json({ discountCode })
}

// ─── DELETE /api/admin/discount-codes/[id] ───────────────────

/**
 * DELETE /api/admin/discount-codes/[id] — remove a discount code.
 * Requires canManageSettings permission.
 * Response: { success: true }
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const admin = await createAdminClient()
  const { error } = await admin
    .from('discount_codes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting discount code:', error)
    return NextResponse.json({ error: 'Failed to delete discount code' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
