'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/services/supabase/client'
import { getAdminRole, type AdminRole } from '@/services/supabase/admin'

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userRole, setUserRole] = useState<AdminRole | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        const role = await getAdminRole(supabase, user.email)
        setUserRole(role)
      }
    }
    fetchUser()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const allNavItems = [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/upload', label: 'Upload' },
    { href: '/admin/projects', label: 'Projects' },
    { href: '/admin/team', label: 'Team' },
    { href: '/admin/vision', label: 'Vision' },
    { href: '/admin/app', label: 'APP' },
  ]

  const navItems = allNavItems.filter(item => {
    if (item.href === '/admin/team' || item.href === '/admin/vision') {
      return userRole === 'super_admin'
    }
    return true
  })

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black/10">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6 md:gap-12">
          <Link href="/admin/dashboard" className="text-2xl font-bold tracking-tight">
            OOO
          </Link>
          
          {/* Desktop navigation - hidden on mobile */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm uppercase tracking-widest transition-opacity ${
                  pathname === item.href || pathname.startsWith(item.href + '/')
                    ? 'text-black'
                    : 'text-neutral-400 hover:text-black'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          <Link
            href="/"
            className="text-sm uppercase tracking-widest text-neutral-400 hover:text-black transition-opacity"
          >
            View Site
          </Link>
          <button
            onClick={handleSignOut}
            className="text-sm uppercase tracking-widest text-neutral-400 hover:text-black transition-opacity"
          >
            Sign Out
          </button>
          
          {/* Mobile hamburger button - visible only on mobile */}
          <button
            className="md:hidden flex flex-col justify-center items-center w-6 h-6 gap-1"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-0.5 bg-black transition-transform duration-200 ${mobileMenuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <span className={`block w-5 h-0.5 bg-black transition-opacity duration-200 ${mobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-black transition-transform duration-200 ${mobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <nav className="md:hidden bg-white border-t border-black/10 px-6 py-4">
          <div className="flex flex-col gap-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-sm uppercase tracking-widest transition-opacity ${
                  pathname === item.href || pathname.startsWith(item.href + '/')
                    ? 'text-black'
                    : 'text-neutral-400 hover:text-black'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
