/**
 * @file route.ts
 * @description App settings endpoint. GET is semi-public: unauthenticated callers receive
 * only the PUBLIC_FIELDS subset (used by the order form); authenticated callers receive all
 * fields. PATCH is permission-gated (canManageSettings).
 *
 * Key invariants:
 * - `admin_phone` is an ntfy.sh topic name, not a phone number.
 * - `createAdminClient()` (bypasses RLS) is used for DB reads/writes; the auth check is
 *   done separately via the session client.
 * - Public field list is intentionally narrow to avoid leaking admin_phone / notification
 *   settings to anonymous visitors.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// Fields returned to unauthenticated callers (order form, public pages).
const PUBLIC_FIELDS = [
  'id', 'app_name', 'logo_url', 'mission_banner_url', 'badge_url', 'shirt_price', 'available_sizes',
  'school_orders_enabled', 'government_orders_enabled',
  'personal_orders_enabled', 'private_company_orders_enabled',
  'manual_payment_enabled', 'cash_enabled', 'personal_allowed_payment_methods', 'confirmation_message',
  'qr_tagline', 'order_fees',
]

// ─── GET /api/admin/settings ──────────────────────────────────

/**
 * GET /api/admin/settings — read app settings.
 * Unauthenticated: returns only PUBLIC_FIELDS (order form subset).
 * Authenticated: returns full settings row including admin_phone and notification flags.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = await createAdminClient()
  const { data: settings, error } = await admin
    .from('app_settings')
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }

  // Unauthenticated callers (order form) only receive public-safe fields
  if (!user) {
    const publicSettings: Record<string, unknown> = {}
    for (const key of PUBLIC_FIELDS) {
      publicSettings[key] = (settings as Record<string, unknown>)[key]
    }
    return NextResponse.json({ settings: publicSettings })
  }

  return NextResponse.json({ settings })
}

// ─── PATCH /api/admin/settings ────────────────────────────────

/**
 * PATCH /api/admin/settings — update app settings. Requires canManageSettings permission.
 * Only whitelisted fields are applied; unknown keys are ignored.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ─── Auth & Permission Checks ────────────────────────────────
  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const adminSupabase = await createAdminClient()
  const body = await request.json()

  const allowedFields = [
    'app_name', 'logo_url', 'mission_banner_url', 'badge_url', 'shirt_price', 'available_sizes',
    'school_orders_enabled', 'government_orders_enabled',
    'personal_orders_enabled', 'private_company_orders_enabled',
    'manual_payment_enabled', 'cash_enabled', 'personal_allowed_payment_methods', 'confirmation_message',
    'admin_phone', 'sms_notifications_enabled', 'qr_tagline', 'order_fees',
  ]

  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) {
      updateData[field] = body[field]
    }
  }

  const { data: settings, error } = await adminSupabase
    .from('app_settings')
    .update(updateData)
    .not('id', 'is', null)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }

  return NextResponse.json({ settings })
}
