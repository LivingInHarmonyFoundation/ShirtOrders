/**
 * @file discounts.ts
 * @description SERVER-ONLY. Shared discount-code validation used by both the
 * legacy per-order endpoint (/api/orders/[id]/discount — still needed for
 * pending orders paid later via link) and the checkout-session endpoint
 * (/api/checkout-sessions/[id]/discount). Keeping one implementation means a
 * restriction (institution type / entity name, expiry, usage limit) can never
 * be enforced on one path and forgotten on the other.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface DiscountTarget {
  institution_type: string
  school_name?: string | null
  organization_name?: string | null
  company_name?: string | null
}

export interface ValidDiscount {
  code: string
  type: 'percentage' | 'fixed'
  value: number
}

export type DiscountResult =
  | { ok: true; discount: ValidDiscount }
  | { ok: false; error: string; status: number }

/**
 * validateDiscountForTarget — looks up `code` and checks it can be applied to
 * an order for `target`. Mirrors the rules of /api/discount-codes/validate.
 */
export async function validateDiscountForTarget(
  admin: SupabaseClient,
  code: string,
  target: DiscountTarget,
): Promise<DiscountResult> {
  const { data: discountCode, error: codeError } = await admin
    .from('discount_codes')
    .select('id, code, type, value, expires_at, enabled, max_uses, restricted_to_type, restricted_to_name')
    .ilike('code', String(code).trim())
    .maybeSingle()

  if (codeError) {
    console.error('Error looking up discount code:', codeError)
    return { ok: false, error: 'Failed to validate code', status: 500 }
  }
  if (!discountCode) return { ok: false, error: 'Discount code not found', status: 404 }
  if (!discountCode.enabled) return { ok: false, error: 'Code is disabled', status: 400 }
  if (discountCode.expires_at && new Date(discountCode.expires_at) < new Date()) {
    return { ok: false, error: 'Code has expired', status: 400 }
  }

  // Usage limit check — count all non-cancelled orders that carry this code
  if (discountCode.max_uses != null) {
    const { count } = await admin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('discount_code', discountCode.code)
      .not('payment_status', 'in', '("failed","refunded")')

    if ((count ?? 0) >= discountCode.max_uses) {
      return { ok: false, error: 'This code has reached its usage limit', status: 400 }
    }
  }

  // Institution restriction check
  if (discountCode.restricted_to_type) {
    if (target.institution_type !== discountCode.restricted_to_type) {
      const typeLabel: Record<string, string> = {
        school: 'school',
        government: 'government agency',
        personal: 'personal',
        private_company: 'company',
      }
      return {
        ok: false,
        error: `This code is restricted to ${typeLabel[discountCode.restricted_to_type] ?? discountCode.restricted_to_type} orders`,
        status: 400,
      }
    }

    if (discountCode.restricted_to_name && target.institution_type !== 'personal') {
      const entityName: string | null =
        target.institution_type === 'school'          ? (target.school_name ?? null) :
        target.institution_type === 'government'      ? (target.organization_name ?? null) :
        target.institution_type === 'private_company' ? (target.company_name ?? null) :
        null

      if (!entityName || entityName.toLowerCase() !== discountCode.restricted_to_name.toLowerCase()) {
        return { ok: false, error: `This code is restricted to: ${discountCode.restricted_to_name}`, status: 400 }
      }
    }
  }

  return { ok: true, discount: { code: discountCode.code, type: discountCode.type, value: discountCode.value } }
}

/** Discount amount for `baseTotal` (pre-discount), rounded to cents and capped at the total. */
export function computeDiscountAmount(discount: ValidDiscount, baseTotal: number): number {
  if (discount.type === 'percentage') {
    return Math.round(baseTotal * (discount.value / 100) * 100) / 100
  }
  return Math.min(discount.value, baseTotal)
}
