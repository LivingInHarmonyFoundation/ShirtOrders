/**
 * @file route.ts
 * @description Public endpoint that returns all currently effective campaigns.
 * "Effective" means is_active=true AND either: within the annual window (recurring),
 * or end_date not yet passed (non-recurring).
 *
 * Response: { campaigns: Campaign[] } — empty array when no campaigns are active.
 * When exactly one campaign is active the client renders no picker (seamless).
 * When multiple are active the client shows a campaign selection step.
 *
 * Uses createAdminClient() (service role) since no user session exists here.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

function isInAnnualWindow(now: Date, startDate: string, endDate: string): boolean {
  const s = new Date(startDate)
  const e = new Date(endDate)
  const nowMD = now.getMonth() * 100 + now.getDate()
  const startMD = s.getMonth() * 100 + s.getDate()
  const endMD = e.getMonth() * 100 + e.getDate()
  if (startMD <= endMD) return nowMD >= startMD && nowMD <= endMD
  return nowMD >= startMD || nowMD <= endMD
}

export async function GET() {
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('campaigns')
    .select('id, name, description, start_date, end_date, is_active, is_recurring, ended_message')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const campaigns = (data || []).filter(c => {
    if (c.is_recurring && c.start_date && c.end_date) {
      return isInAnnualWindow(now, c.start_date, c.end_date)
    }
    if (c.end_date && c.end_date < todayStr) return false
    return true
  })

  return NextResponse.json({ campaigns })
}
