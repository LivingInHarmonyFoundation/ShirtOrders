/**
 * @file sidebar.tsx
 * @description Admin navigation sidebar and mobile top bar. Nav items are filtered
 * client-side by the current user's permissions (from RoleProvider/useRole). This
 * filtering is UI-only — server API routes enforce permissions independently.
 *
 * On desktop: a fixed 56-wide left sidebar with brand logo, nav items, and sign-out.
 * On mobile: a fixed top bar with hamburger; tapping opens a 56-wide drawer overlay.
 *
 * Active route detection uses pathname prefix matching so nested routes
 * (e.g. /admin/orders/[id]) also highlight the Orders nav item.
 */
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, List, BarChart2, Settings,
  LogOut, Menu, X, ChevronRight, GraduationCap, Users, Shirt, Building2, Briefcase, Megaphone, QrCode, Tag, Archive
} from 'lucide-react'
import { useState } from 'react'
import { useRole } from '@/components/admin/role-provider'
import LanguageSelector from '@/components/shared/LanguageSelector'
import { useT } from '@/contexts/LanguageContext'

/**
 * AdminSidebar — responsive sidebar that renders a desktop aside and a mobile
 * drawer. Nav items visible to the current user are filtered by useRole().permissions.
 * Permission enforcement is always also done server-side in the API routes.
 */
export default function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { permissions } = useRole()
  const t = useT()

  const allNavItems = [
    { href: '/admin/dashboard',  label: t('admin', 'dashboard'),  icon: LayoutDashboard, show: true },
    { href: '/admin/orders',     label: t('admin', 'orders'),     icon: List,            show: true },
    { href: '/admin/catalog',    label: t('admin', 'catalog'),    icon: Shirt,           show: permissions.canManageSettings },
    { href: '/admin/government', label: t('admin', 'government'), icon: Building2,       show: permissions.canManageSettings },
    { href: '/admin/companies',  label: t('admin', 'companies'),  icon: Briefcase,       show: permissions.canManageSettings },
    { href: '/admin/campaigns',  label: t('admin', 'campaigns'),  icon: Megaphone,       show: permissions.canManageSettings },
    { href: '/admin/qr-code',         label: t('admin', 'qrCode'),        icon: QrCode, show: permissions.canManageSettings },
    { href: '/admin/discount-codes',  label: t('admin', 'discountCodes'), icon: Tag,    show: permissions.canManageSettings },
    { href: '/admin/inventory',       label: t('admin', 'inventory'),     icon: Archive, show: permissions.canManageSettings },
    { href: '/admin/schools',    label: t('admin', 'schools'),    icon: GraduationCap,   show: permissions.canManageSchools },
    { href: '/admin/reports',    label: t('admin', 'reports'),    icon: BarChart2,       show: permissions.canViewReports },
    { href: '/admin/settings',   label: t('admin', 'settings'),   icon: Settings,        show: permissions.canManageSettings },
    { href: '/admin/team',       label: t('admin', 'team'),       icon: Users,           show: permissions.canManageTeam },
  ]

  const navItems = allNavItems.filter(item => item.show)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-white/10 space-y-3">
        <div className="bg-white rounded-xl p-3 flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="Living in Harmony Foundation"
            width={160}
            height={100}
            className="object-contain w-full h-auto"
            priority
          />
        </div>
        <div className="flex justify-center">
          <LanguageSelector variant="dark" />
        </div>
      </div>

      {/* Nav label */}
      <div className="px-4 pt-5 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(206,220,0,0.45)' }}>
          {t('admin', 'menu')}
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 pb-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150',
                isActive
                  ? 'text-white'
                  : 'hover:text-green-50 hover:bg-white/6'
              )}
              style={isActive ? { backgroundColor: 'rgba(255,255,255,0.1)' } : {}}
            >
              {/* Active left indicator */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                  style={{ backgroundColor: '#CEDC00' }}
                />
              )}
              <Icon
                className={cn('w-4 h-4 flex-shrink-0')}
                style={{ color: isActive ? '#CEDC00' : 'rgba(209,250,229,0.45)' }}
              />
              <span style={{ color: isActive ? 'white' : 'rgba(209,250,229,0.65)' }}>{label}</span>
              {isActive && (
                <ChevronRight className="w-3 h-3 ml-auto" style={{ color: 'rgba(206,220,0,0.6)' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-4 border-t border-white/10 pt-4 space-y-1">
        <div className="px-3 py-1.5">
          <p className="text-[11px] truncate" style={{ color: 'rgba(206,220,0,0.5)' }}>{userEmail}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-sm transition-colors duration-150"
          style={{ color: 'rgba(209,250,229,0.45)' }}
        >
          <LogOut className="w-4 h-4 mr-2" /> {t('admin', 'signOut')}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0" style={{ backgroundColor: '#00352F' }}>
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 border-b border-white/10 px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: '#00352F' }}
      >
        <div className="flex items-center">
          <div className="bg-white rounded-lg px-2.5 py-1.5">
            <Image
              src="/logo.png"
              alt="Living in Harmony Foundation"
              width={120}
              height={38}
              className="object-contain h-8 w-auto"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector variant="dark" />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded-xl transition-colors"
            style={{ color: 'rgba(209,250,229,0.6)' }}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 mt-[52px]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 h-full" style={{ backgroundColor: '#00352F' }}>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Mobile spacer */}
      <div className="md:hidden h-[52px] w-0" />
    </>
  )
}
