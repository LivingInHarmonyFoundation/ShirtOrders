import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { password } = await request.json()
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  // Update the password
  const { error: pwError } = await supabase.auth.updateUser({ password })
  if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 })

  // Clear the must_change_password flag
  const admin = await createAdminClient()
  await admin
    .from('team_members')
    .update({ must_change_password: false })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
