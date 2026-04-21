/**
 * @file route.ts
 * @description Password change endpoint for authenticated admin users. POST validates the
 * new password against minimum strength requirements, then updates the user's Supabase
 * Auth password and clears the `must_change_password` flag in user metadata in a single
 * call. Uses the session client (`createClient()`) so the update is scoped to the
 * authenticated user — no admin client or permission key is required beyond a valid session.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── POST /api/admin/set-password ────────────────────────────

/**
 * POST /api/admin/set-password — update the current user's password.
 * Auth-only — requires a valid session (no additional permission key).
 * Uses the session-scoped client (`createClient()`); the update is restricted to the
 * calling user and does not bypass RLS.
 * Password requirements (validated server-side):
 *   - Minimum 8 characters
 *   - At least one uppercase letter
 *   - At least one number
 * On success, also clears the `must_change_password` flag in auth user metadata so
 * the forced-password-change flow does not re-trigger.
 * Body: { password: string }
 * Response: { success: true }
 */
export async function POST(request: NextRequest) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Password Strength Validation ────────────────────────────
  const { password } = await request.json()
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (!/[A-Z]/.test(password)) {
    return NextResponse.json({ error: 'Password must contain at least one uppercase letter' }, { status: 400 })
  }
  if (!/[0-9]/.test(password)) {
    return NextResponse.json({ error: 'Password must contain at least one number' }, { status: 400 })
  }

  // ─── Password Update ──────────────────────────────────────────
  // Update password and clear the must_change_password flag in one call
  const { error } = await supabase.auth.updateUser({
    password,
    data: { must_change_password: false },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
