/**
 * @file route.ts
 * @description App settings endpoint.
 *
 * GET  — semi-public: unauthenticated callers receive only PUBLIC_FIELDS (order form);
 *         authenticated callers receive the full row.
 * PATCH — permission-gated (canManageSettings). All incoming values are validated
 *         with Zod before touching the database.
 *
 * Key invariants:
 * - `admin_phone` is an ntfy.sh topic name, not a phone number.
 * - `createAdminClient()` bypasses RLS; the auth check is done separately via the session client.
 * - Public field list is intentionally narrow to avoid leaking admin_phone / notification settings.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── Constants ────────────────────────────────────────────────

/** Columns returned to unauthenticated callers (order form, public pages). */
const PUBLIC_FIELDS = [
  'id', 'app_name', 'logo_url', 'mission_banner_url', 'badge_url',
  'school_orders_enabled', 'government_orders_enabled',
  'personal_orders_enabled', 'private_company_orders_enabled', 'staff_orders_enabled',
  'manual_payment_enabled', 'cash_enabled',
  'cash_enabled_school', 'cash_enabled_government', 'cash_enabled_private_company',
  'personal_allowed_payment_methods', 'confirmation_message',
  'qr_tagline', 'order_fees',
]

const VALID_INSTITUTION_TYPES = ['school', 'government', 'personal', 'private_company', 'staff'] as const
const VALID_PAYMENT_METHODS   = ['paypal', 'venmo', 'card', 'cash'] as const

// ─── Zod Schemas ──────────────────────────────────────────────

/**
 * Validates a single fee object before it is stored in `app_settings.order_fees`.
 * Percentage fees are capped at 100; fixed fees have no upper bound.
 */
const OrderFeeSchema = z.object({
  id:         z.string().uuid(),
  name:       z.string().min(1).max(100),
  type:       z.enum(['percentage', 'fixed']),
  value:      z.number().positive(),
  applies_to: z.array(z.enum(VALID_INSTITUTION_TYPES)).nullable(),
}).refine(
  fee => fee.type !== 'percentage' || fee.value <= 100,
  { message: 'Percentage fee value cannot exceed 100' },
)

// ─── GET /api/admin/settings ──────────────────────────────────

/**
 * Returns app settings.
 * - Unauthenticated: selects only PUBLIC_FIELDS columns at the DB level.
 * - Authenticated: selects all columns.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = await createAdminClient()

  if (!user) {
    // Select only the public columns — data boundary enforced at the query level.
    const { data: settings, error } = await admin
      .from('app_settings')
      .select(PUBLIC_FIELDS.join(', '))
      .single()

    if (error) return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    return NextResponse.json({ settings })
  }

  const { data: settings, error } = await admin
    .from('app_settings')
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  return NextResponse.json({ settings })
}

// ─── PATCH /api/admin/settings ────────────────────────────────

/**
 * Updates app settings. Requires canManageSettings permission.
 * Only allowlisted fields are applied; all values are validated before writing.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  const body = await request.json()

  // Build the update payload from the allowlist — unknown keys are ignored.
  const allowedFields = [
    'app_name', 'logo_url', 'mission_banner_url', 'badge_url',
    'school_orders_enabled', 'government_orders_enabled',
    'personal_orders_enabled', 'private_company_orders_enabled', 'staff_orders_enabled',
    'manual_payment_enabled', 'cash_enabled',
    'cash_enabled_school', 'cash_enabled_government', 'cash_enabled_private_company',
    'personal_allowed_payment_methods', 'confirmation_message',
    'admin_phone', 'sms_notifications_enabled', 'qr_tagline', 'order_fees',
  ]

  const updateData: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (field in body) updateData[field] = body[field]
  }

  // ─── Validation ───────────────────────────────────────────

  // order_fees: validate each fee's structure and value ranges.
  // A malformed fee (e.g. value: -9999) would silently corrupt order totals at creation time.
  if ('order_fees' in updateData) {
    const result = z.array(OrderFeeSchema).safeParse(updateData.order_fees)
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid order_fees' }, { status: 400 })
    }
    updateData.order_fees = result.data
  }

  // admin_phone: must be a valid ntfy.sh topic name (alphanumeric, hyphens, underscores).
  // Prevents URL injection in the notification sender.
  if ('admin_phone' in updateData && updateData.admin_phone !== null) {
    if (
      typeof updateData.admin_phone !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(updateData.admin_phone)
    ) {
      return NextResponse.json({ error: 'Invalid notification topic name' }, { status: 400 })
    }
  }

  // confirmation_message: cap at 2000 characters to prevent bloating the public GET response.
  if ('confirmation_message' in updateData) {
    if (
      typeof updateData.confirmation_message !== 'string' ||
      updateData.confirmation_message.length > 2000
    ) {
      return NextResponse.json({ error: 'confirmation_message too long (max 2000 chars)' }, { status: 400 })
    }
  }

  // personal_allowed_payment_methods: must be null (= all methods) or an array of known values.
  if ('personal_allowed_payment_methods' in updateData) {
    const v = updateData.personal_allowed_payment_methods
    if (v !== null) {
      if (!Array.isArray(v) || !v.every(m => (VALID_PAYMENT_METHODS as readonly string[]).includes(m as string))) {
        return NextResponse.json({ error: 'Invalid payment methods' }, { status: 400 })
      }
    }
  }

  // ─── Persist ──────────────────────────────────────────────

  const adminSupabase = await createAdminClient()
  const { data: settings, error } = await adminSupabase
    .from('app_settings')
    .update(updateData)
    .not('id', 'is', null)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  return NextResponse.json({ settings })
}
