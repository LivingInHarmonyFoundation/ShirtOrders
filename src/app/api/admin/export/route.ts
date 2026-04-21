/**
 * @file route.ts
 * @description Order export endpoint. GET streams a CSV file of orders filtered by optional
 * query parameters. Applies CSV formula injection protection on every cell value. Requires
 * authentication and the `canExportData` permission. Uses `createAdminClient()` (bypasses
 * RLS) to query all orders regardless of row policies.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { CSV_HEADERS, buildOrderCsvRow } from '@/lib/utils'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── CSV Formula Injection Protection ────────────────────────

/**
 * Characters that, when leading a cell value, cause spreadsheet applications
 * (Excel, LibreOffice, Google Sheets) to interpret the cell as a formula.
 * Cells starting with any of these are prefixed with a single-quote to neutralize them.
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r']

/**
 * Escape a single CSV cell value for safe output.
 * Prevents formula injection by prepending a single-quote to values that begin with
 * a known formula trigger character. Also wraps values containing commas, double-quotes,
 * or newlines in double-quotes and escapes interior double-quotes per RFC 4180.
 */
function escapeCsvValue(value: string): string {
  // Neutralize potential formula injection (Excel/LibreOffice/Google Sheets)
  if (FORMULA_PREFIXES.some(p => value.startsWith(p))) {
    value = `'${value}`
  }
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ─── GET /api/admin/export ────────────────────────────────────

/**
 * GET /api/admin/export — generate and download a CSV of orders matching the given filters.
 * Requires authentication and the `canExportData` permission.
 * Supported query parameters (all optional):
 *   institution_type, payment_status, delivery_status, shirt_size,
 *   date_from, date_to, organization_name, school_name, company_name, campaign_id
 * `campaign_id=all` is treated as no filter.
 * `date_to` is extended to end-of-day (T23:59:59) so the full day is included.
 * Uses createAdminClient() (bypasses RLS) to access all orders.
 * Response: text/csv attachment with a date-stamped filename.
 */
export async function GET(request: NextRequest) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canExportData')
  if (auth instanceof NextResponse) return auth

  // ─── Filter Parameters ────────────────────────────────────────
  // createAdminClient() bypasses RLS — required to read all orders for export
  const adminSupabase = await createAdminClient()
  const { searchParams } = request.nextUrl

  const institution_type = searchParams.get('institution_type') || ''
  const payment_status = searchParams.get('payment_status') || ''
  const delivery_status = searchParams.get('delivery_status') || ''
  const shirt_size = searchParams.get('shirt_size') || ''
  const date_from = searchParams.get('date_from') || ''
  const date_to = searchParams.get('date_to') || ''
  const organization_name = searchParams.get('organization_name') || ''
  const school_name = searchParams.get('school_name') || ''
  const company_name = searchParams.get('company_name') || ''
  const campaign_id = searchParams.get('campaign_id') || ''

  // ─── Query & Filtering ────────────────────────────────────────
  let query = adminSupabase.from('orders').select('*').order('created_at', { ascending: false })

  if (institution_type) query = query.eq('institution_type', institution_type)
  if (payment_status) query = query.eq('payment_status', payment_status)
  if (delivery_status) query = query.eq('delivery_status', delivery_status)
  if (shirt_size) query = query.eq('shirt_size', shirt_size)
  if (date_from) query = query.gte('created_at', date_from)
  // Extend date_to to end-of-day so the full day is included in the range
  if (date_to) query = query.lte('created_at', date_to + 'T23:59:59')
  if (organization_name) query = query.eq('organization_name', organization_name)
  if (school_name) query = query.eq('school_name', school_name)
  if (company_name) query = query.eq('company_name', company_name)
  // 'all' is the UI sentinel for "no campaign filter" — treat it as unfiltered
  if (campaign_id && campaign_id !== 'all') query = query.eq('campaign_id', campaign_id)

  const { data: orders, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }

  // ─── CSV Generation ───────────────────────────────────────────
  // Each cell passes through escapeCsvValue to prevent formula injection
  const rows = [
    CSV_HEADERS.map(escapeCsvValue).join(','),
    ...(orders || []).map(order => buildOrderCsvRow(order).map(escapeCsvValue).join(',')),
  ]

  const csv = rows.join('\n')
  const filename = `shirt-orders-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
