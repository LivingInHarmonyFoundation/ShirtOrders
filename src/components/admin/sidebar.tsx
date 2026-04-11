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
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 p-1 shadow-sm">
          <Image
            src="/logo.png"
            alt="Living in Harmony Foundation"
            width={36}
            height={36}
            className="object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white text-xs leading-none truncate">Living in Harmony</p>
          <p className="text-green-400 text-xs mt-0.5 truncate">Foundation</p>
        </div>
      </div>

      {/* Nav label */}
      <div className="px-4 pt-5 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-green-500/60">Navigation</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 pb-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-all',
                isActive
                  ? 'bg-white/10 text-[#8DC63F]'
                  : 'text-green-100/70 hover:bg-white/8 hover:text-green-50'
              )}
            >
              <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-[#8DC63F]' : 'text-green-100/50')} />
              {label}
              {isActive && <ChevronRight className="w-3 h-3 ml-auto text-[#8DC63F]" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 pb-4 border-t border-white/10 pt-4">
        <div className="px-3 py-1.5 mb-2">
          <p className="text-[10px] text-green-400/60 truncate">{userEmail}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-green-100/60 hover:text-red-300 hover:bg-red-900/20"
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
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center p-0.5">
            <Image
              src="/logo.png"
              alt="LIH"
              width={24}
              height={24}
              className="object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <span className="font-semibold text-white text-sm">LIH Foundation</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 rounded-lg text-green-100/70 hover:bg-white/10"
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
