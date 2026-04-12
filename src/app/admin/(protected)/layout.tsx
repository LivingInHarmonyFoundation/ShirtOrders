import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/admin/sidebar'
import { RoleProvider } from '@/components/admin/role-provider'
import type { UserRole } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const admin = await createAdminClient()

  // Step 1: Look up by user_id (fastest path)
  let { data: member } = await admin
    .from('team_members')
    .select('id, role, is_active, full_name, must_change_password')
    .eq('user_id', user.id)
    .maybeSingle()

  // Step 2: If not found, check for a pending invite by email (user just accepted)
  if (!member) {
    const { data: pendingByEmail } = await admin
      .from('team_members')
      .select('id, role, is_active, full_name')
      .eq('email', user.email!)
      .is('user_id', null)
      .maybeSingle()

    if (pendingByEmail) {
      await admin
        .from('team_members')
        .update({ user_id: user.id })
        .eq('id', pendingByEmail.id)
      member = pendingByEmail
    }
  }

  // Step 3: Still not found → first-time bootstrap, create owner record
  if (!member) {
    await admin
      .from('team_members')
      .insert({
        user_id: user.id,
        email: user.email!,
        full_name: null,
        role: 'owner',
        is_active: true,
      })
    member = { id: '', role: 'owner', is_active: true, full_name: null }
  }

  // Block inactive members
  if (!member.is_active) {
    redirect('/admin/login')
  }

  // Force password change for new members
  if (member.must_change_password) {
    redirect('/admin/set-password')
  }

  const role = member.role as UserRole

  return (
    <RoleProvider role={role}>
      <div className="min-h-screen flex" style={{ backgroundColor: '#F5F4F0' }}>
        <AdminSidebar userEmail={user.email || ''} />
        <main className="flex-1 min-w-0 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </RoleProvider>
  )
}
