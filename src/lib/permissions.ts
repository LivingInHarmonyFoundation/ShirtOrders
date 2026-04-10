import type { UserRole } from '@/types'

export interface Permissions {
  canManageTeam:     boolean   // invite / change roles / remove members
  canManageSettings: boolean   // app settings
  canManageSchools:  boolean   // add / toggle / delete school links
  canViewReports:    boolean   // reports & export tab
  canExportData:     boolean   // CSV download
  canManageOrders:   boolean   // view, edit, bulk-update orders
}

const ROLE_PERMISSIONS: Record<UserRole, Permissions> = {
  owner: {
    canManageTeam:     true,
    canManageSettings: true,
    canManageSchools:  true,
    canViewReports:    true,
    canExportData:     true,
    canManageOrders:   true,
  },
  admin: {
    canManageTeam:     false,
    canManageSettings: true,
    canManageSchools:  true,
    canViewReports:    true,
    canExportData:     true,
    canManageOrders:   true,
  },
  staff: {
    canManageTeam:     false,
    canManageSettings: false,
    canManageSchools:  false,
    canViewReports:    false,
    canExportData:     false,
    canManageOrders:   true,
  },
}

export function getPermissions(role: UserRole): Permissions {
  return ROLE_PERMISSIONS[role]
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: 'Full access including team management',
  admin: 'Manage orders, schools, settings, and reports',
  staff: 'View and update orders only',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  owner: 'bg-[#1B4D2E] text-white border-[#1B4D2E]',
  admin: 'bg-[#EFF8E8] text-[#1B4D2E] border-[#8DC63F]/40',
  staff: 'bg-gray-100 text-gray-700 border-gray-200',
}
