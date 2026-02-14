import { createClient } from '@/services/supabase/server'
import { notFound } from 'next/navigation'
import EditAppUserForm from '@/components/admin/EditAppUserForm'
import type { AppUser } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditUserPage({ params }: PageProps) {
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

  return <EditAppUserForm user={user as AppUser} />
}
