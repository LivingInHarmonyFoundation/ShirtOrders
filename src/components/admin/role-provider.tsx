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

export function useRole(): RoleContextValue {
  return useContext(RoleContext)
}

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
