/**
 * @file layout.tsx
 * @description Server-side layout that protects every route under /admin/(protected).
 * All child pages rely on this layout for authentication — no per-page auth is needed.
 *
 * Three bootstrap checks run in order:
 *   1. Valid Supabase session — redirects to /admin/login if absent.
 *   2. Team membership — looks up by user_id, then by pending email invite, then
 *      bootstraps the first authenticated user as 'owner' if no record exists at all.
 *   3. must_change_password metadata — redirects new members to /admin/set-password
 *      so they set a permanent password before accessing any admin page.
 *
 * The resolved role is distributed to all children via RoleProvider / useRole().
 */
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/admin/sidebar'
import { RoleProvider } from '@/components/admin/role-provider'
import type { UserRole } from '@/types'

/**
 * AdminLayout — async Server Component that gates all protected admin pages.
 * Handles session validation, team-member lookup, first-user bootstrap, and
 * the must_change_password redirect before rendering any child content.
 */
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
    .select('id, role, is_active, full_name')
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

  // Force password change for new members (flag stored in auth user metadata)
  if (user.user_metadata?.must_change_password === true) {
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
