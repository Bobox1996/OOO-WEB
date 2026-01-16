'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/upload', label: 'Upload' },
    { href: '/admin/projects', label: 'Projects' },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black/10">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-12">
          <Link href="/admin/dashboard" className="text-2xl font-bold tracking-tight">
            OOO
          </Link>
          <nav className="flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm uppercase tracking-widest transition-opacity ${
                  pathname === item.href
                    ? 'text-black'
                    : 'text-neutral-400 hover:text-black'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-6">
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
        </div>
      </div>
    </header>
  )
}
