'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/services/supabase/client'

export default function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setUserEmail(user.email)
    }
    fetchUser()
  }, [supabase])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/app/login')
    router.refresh()
  }

  const navItems = [
    { href: '/app', label: 'Dashboard' },
    { href: '/app/design', label: 'Design' },
    { href: '/app/history', label: 'History' },
  ]

  const isActive = (href: string) => {
    if (href === '/app') return pathname === '/app'
    return pathname.startsWith(href)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black/10">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6 md:gap-12">
          <Link href="/app" className="text-2xl font-bold tracking-tight">
            OOO
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm uppercase tracking-widest transition-opacity ${
                  isActive(item.href)
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

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-8 h-8 rounded-full border border-black/20 flex items-center justify-center hover:border-black transition-colors"
              aria-label="Profile menu"
            >
              <svg className="w-4 h-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-black/10 shadow-lg">
                {userEmail && (
                  <div className="px-4 py-3 border-b border-black/10">
                    <p className="text-xs uppercase tracking-wider text-neutral-400 mb-1">Signed in as</p>
                    <p className="text-sm font-medium truncate">{userEmail}</p>
                  </div>
                )}
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-3 text-sm uppercase tracking-widest text-neutral-400 hover:text-black hover:bg-neutral-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
          
          {/* Mobile hamburger */}
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
                  isActive(item.href)
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
