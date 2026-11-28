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

  // The alpine scene owns its viewport and photography UI; authentication still
  // runs through the shared /admin middleware.
  if (pathname === '/admin/app/experiments/mountain-cabin') {
    return <>{children}</>
  }

  if (pathname === '/admin/app' || pathname.startsWith('/admin/app/experiments/')) {
    return (
      <>
        <AdminNav />
        <main className="px-5 pt-24 pb-12 md:px-8">
          {pathname !== '/admin/app' && (
            <div className="max-w-[60rem] mx-auto mb-6">
              <Link href="/admin/app" className="text-sm text-neutral-600 hover:underline">← Experiments</Link>
            </div>
          )}
          {children}
        </main>
      </>
    )
  }

  const tabs = [
    { href: '/admin/app/users', label: 'Users' },
    { href: '/admin/app/assets', label: 'Assets' },
    { href: '/admin/app/color-themer', label: 'Color Themer' },
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
            <Link href="/admin/app" className="mb-5 inline-block text-sm text-neutral-600 hover:underline">← Experiments</Link>
            <h1 className="text-display font-semibold leading-tight tracking-tight uppercase">
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
