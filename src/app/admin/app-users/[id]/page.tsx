import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/AdminNav'
import { notFound } from 'next/navigation'
import EditAppUserForm from './EditAppUserForm'
import type { AppUser } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditAppUserPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: user, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !user) {
    notFound()
  }

  return (
    <>
      <AdminNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-md mx-auto">
          <EditAppUserForm user={user as AppUser} />
        </div>
      </main>
    </>
  )
}
