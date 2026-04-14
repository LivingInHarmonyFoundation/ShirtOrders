'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, List, BarChart2, Settings,
  LogOut, Menu, X, ChevronRight, GraduationCap, Users, Shirt, Building2
} from 'lucide-react'
import { useState } from 'react'
import { useRole } from '@/components/admin/role-provider'

export default function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { permissions } = useRole()

  const allNavItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { href: '/admin/orders',    label: 'Orders',     icon: List,            show: true },
    { href: '/admin/catalog',        label: 'Catalog',       icon: Shirt,         show: permissions.canManageSettings },
    { href: '/admin/government',     label: 'Organizations', icon: Building2,     show: permissions.canManageSettings },
    { href: '/admin/schools',        label: 'Schools',       icon: GraduationCap, show: permissions.canManageSchools },
    { href: '/admin/reports',   label: 'Reports',    icon: BarChart2,       show: permissions.canViewReports },
    { href: '/admin/settings',  label: 'Settings',   icon: Settings,        show: permissions.canManageSettings },
    { href: '/admin/team',      label: 'Team',       icon: Users,           show: permissions.canManageTeam },
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
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 p-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
        >
          <Image
            src="/logo.png"
            alt="Living in Harmony Foundation"
            width={32}
            height={32}
            className="object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white text-[12px] leading-none truncate">Living in Harmony</p>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: '#8DC63F' }}>Foundation</p>
        </div>
      </div>

      {/* Nav label */}
      <div className="px-4 pt-5 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'rgba(141,198,63,0.45)' }}>
          Menu
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
                  style={{ backgroundColor: '#8DC63F' }}
                />
              )}
              <Icon
                className={cn('w-4 h-4 flex-shrink-0')}
                style={{ color: isActive ? '#8DC63F' : 'rgba(209,250,229,0.45)' }}
              />
              <span style={{ color: isActive ? 'white' : 'rgba(209,250,229,0.65)' }}>{label}</span>
              {isActive && (
                <ChevronRight className="w-3 h-3 ml-auto" style={{ color: 'rgba(141,198,63,0.6)' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-4 border-t border-white/10 pt-4">
        <div className="px-3 py-1.5 mb-2">
          <p className="text-[11px] truncate" style={{ color: 'rgba(141,198,63,0.5)' }}>{userEmail}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-sm transition-colors duration-150"
          style={{ color: 'rgba(209,250,229,0.45)' }}
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0" style={{ backgroundColor: '#0D2E1A' }}>
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 border-b border-white/10 px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: '#0D2E1A' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center p-0.5"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
          >
            <Image
              src="/logo.png"
              alt="LIH"
              width={26}
              height={26}
              className="object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <span className="font-semibold text-white text-sm">LIH Foundation</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 rounded-xl transition-colors"
          style={{ color: 'rgba(209,250,229,0.6)' }}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 mt-[52px]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 h-full" style={{ backgroundColor: '#0D2E1A' }}>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Mobile spacer */}
      <div className="md:hidden h-[52px] w-0" />
    </>
  )
}
