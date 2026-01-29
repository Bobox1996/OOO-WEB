import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/AdminNav'
import Link from 'next/link'
import DeleteAppUserButton from '@/components/DeleteAppUserButton'
import StopAppUserToggle from '@/components/StopAppUserToggle'
import type { AppUser } from '@/lib/types'

export default async function AppUsersPage() {
  const supabase = await createClient()
  
  const { data: users } = await supabase
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: false })

  const appUsers = (users as AppUser[]) || []

  return (
    <>
      <AdminNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="flex items-end justify-between mb-12">
            <div>
              <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
                APP Users
              </h1>
              <p className="text-neutral-500 mt-4 text-lg">Manage users who can access the APP</p>
            </div>
            <Link
              href="/admin/app-users/new"
              className="px-6 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors"
            >
              + New User
            </Link>
          </div>

          {/* Users Table */}
          {appUsers.length > 0 ? (
            <div className="border border-black/10">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-6 py-4 bg-neutral-50 border-b border-black/10">
                <span className="text-sm uppercase tracking-wider text-neutral-500">Email</span>
                <span className="text-sm uppercase tracking-wider text-neutral-500">Name</span>
                <span className="text-sm uppercase tracking-wider text-neutral-500">Status</span>
                <span className="text-sm uppercase tracking-wider text-neutral-500">Added</span>
                <span className="text-sm uppercase tracking-wider text-neutral-500">Actions</span>
              </div>
              
              {/* Table Rows */}
              {appUsers.map((user) => (
                <div 
                  key={user.id} 
                  className={`grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-6 py-4 border-b border-black/5 last:border-b-0 items-center ${
                    user.stopped ? 'bg-red-50/50' : ''
                  }`}
                >
                  <span className={`font-medium truncate ${user.stopped ? 'text-neutral-400 line-through' : ''}`}>
                    {user.email}
                  </span>
                  <span className={`truncate ${user.stopped ? 'text-neutral-300' : 'text-neutral-500'}`}>
                    {user.name || '—'}
                  </span>
                  <span className={`text-xs uppercase tracking-wider font-medium ${
                    user.stopped ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {user.stopped ? 'Stopped' : 'Active'}
                  </span>
                  <span className="text-sm text-neutral-400 whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/app-users/${user.id}`}
                      className="px-4 py-2 border border-black text-black text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                    >
                      Edit
                    </Link>
                    <StopAppUserToggle
                      userId={user.id}
                      userEmail={user.email}
                      isStopped={user.stopped}
                    />
                    <DeleteAppUserButton 
                      userId={user.id} 
                      userEmail={user.email} 
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-black/10 p-16 text-center">
              <p className="text-neutral-500 mb-6">No APP users yet</p>
              <Link
                href="/admin/app-users/new"
                className="inline-block px-6 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors"
              >
                Add First User
              </Link>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-8 p-6 border border-black/10 bg-neutral-50">
            <h3 className="font-medium mb-2">How it works</h3>
            <p className="text-sm text-neutral-500">
              Only users listed here can log in to the APP section. To grant access, add their email address and create their Supabase Auth account. 
              Users can then log in at <code className="bg-white px-1 py-0.5 border border-black/10">/app/login</code> using their credentials.
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
