'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import AdminNav from '@/components/layout/AdminNav'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const tabs = [
    { href: '/admin/app/users', label: 'Users' },
    { href: '/admin/app/assets', label: 'Assets' },
  ]

  // Check if we're on a sub-page (new, edit, etc.)
  const isSubPage = pathname.includes('/new') || pathname.match(/\/[a-f0-9-]{36}$/)

  return (
    <>
      <AdminNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              APP
            </h1>
            <p className="text-neutral-500 mt-4 text-lg">Manage APP users and assets</p>
          </div>

          {/* Tab Navigation - only show on main list pages */}
          {!isSubPage && (
            <div className="flex gap-0 mb-8 border-b border-black/10">
              {tabs.map((tab) => {
                const isActive = pathname.startsWith(tab.href)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`px-6 py-3 text-sm uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                      isActive
                        ? 'border-black text-black font-medium'
                        : 'border-transparent text-neutral-400 hover:text-black'
                    }`}
                  >
                    {tab.label}
                  </Link>
                )
              })}
            </div>
          )}

          {children}
        </div>
      </main>
    </>
  )
}
