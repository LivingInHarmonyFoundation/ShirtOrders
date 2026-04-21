/**
 * @file permissions.ts
 * @description Defines the Permissions interface and maps each named UserRole
 * to its permission set. Also exports role display metadata (labels,
 * descriptions, badge colors).
 *
 * Key invariant: a `null` role means the user is the bootstrap owner (no
 * team_members row exists). That case is handled entirely by the API layer —
 * all permissions are implicitly granted. This file only covers the three
 * named roles: 'owner', 'admin', and 'staff'.
 */
import type { UserRole } from '@/types'

/**
 * Permissions — the complete set of capability flags for a named role.
 * sidebar.tsx uses these flags to filter navigation items client-side;
 * API routes perform the authoritative server-side enforcement.
 */
export interface Permissions {
  canManageTeam:     boolean   // invite / change roles / remove members
  canManageSettings: boolean   // app settings
  canManageSchools:  boolean   // add / toggle / delete school links
  canViewReports:    boolean   // reports & export tab
  canExportData:     boolean   // CSV download
  canManageOrders:   boolean   // view, edit, bulk-update orders
}

// ─── Role Permission Matrix ───────────────────────────────────

/**
 * ROLE_PERMISSIONS — maps each named role to its Permissions object.
 * This is the authoritative source for what each role can do.
 * - owner: full access including team management.
 * - admin: everything except team management.
 * - staff: order view/update only.
 */
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

// ─── Public API ───────────────────────────────────────────────

/**
 * getPermissions — returns the Permissions object for a given UserRole.
 * Used by role-provider.tsx to populate the React context, and by any
 * code that needs to check capabilities without rendering.
 */
export function getPermissions(role: UserRole): Permissions {
  return ROLE_PERMISSIONS[role]
}

// ─── Role Display Metadata ────────────────────────────────────

/**
 * ROLE_LABELS — human-readable display names for each role.
 * Used in the Team admin UI and anywhere a role name is rendered.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
}

/**
 * ROLE_DESCRIPTIONS — one-sentence capability summaries shown in the Team
 * management UI when inviting or editing a team member's role.
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: 'Full access including team management',
  admin: 'Manage orders, schools, settings, and reports',
  staff: 'View and update orders only',
}

/**
 * ROLE_COLORS — Tailwind badge className strings for each role, used to
 * visually distinguish roles in lists and tables throughout the admin UI.
 */
export const ROLE_COLORS: Record<UserRole, string> = {
  owner: 'bg-[#00352F] text-white border-[#00352F]',
  admin: 'bg-[#E5F2F0] text-[#00352F] border-[#CEDC00]/40',
  staff: 'bg-gray-100 text-gray-700 border-gray-200',
}
