/**
 * @file role-provider.tsx
 * @description React context that distributes the current user's role and derived
 * permissions to all admin UI children. The role is resolved server-side in layout.tsx
 * and passed down as a prop to RoleProvider; no client-side fetching is needed.
 *
 * Usage:
 * - RoleProvider: wraps the admin layout shell (rendered in layout.tsx).
 * - useRole(): hook consumed by any client component that needs permission checks.
 *
 * Default context value ('staff') only applies if useRole() is called outside a
 * RoleProvider — this should not happen in normal operation.
 */
'use client'

import { createContext, useContext } from 'react'
import type { UserRole } from '@/types'
import { getPermissions, type Permissions } from '@/lib/permissions'

interface RoleContextValue {
  role: UserRole
  permissions: Permissions
}

const RoleContext = createContext<RoleContextValue>({
  role: 'staff',
  permissions: getPermissions('staff'),
})

/** useRole — hook that returns { role, permissions } for the current admin user. */
export function useRole(): RoleContextValue {
  return useContext(RoleContext)
}

/**
 * RoleProvider — wraps children with a RoleContext that provides the resolved role
 * and the permissions object derived from it. Rendered once in AdminLayout.
 */
export function RoleProvider({
  role,
  children,
}: {
  role: UserRole
  children: React.ReactNode
}) {
  return (
    <RoleContext.Provider value={{ role, permissions: getPermissions(role) }}>
      {children}
    </RoleContext.Provider>
  )
}
