import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminRole = 'super_admin' | 'admin'

export async function getAdminRole(
  supabase: SupabaseClient,
  email: string
): Promise<AdminRole | null> {
  const { data } = await supabase
    .from('admin_users')
    .select('role')
    .ilike('email', email)
    .single()

  return (data?.role as AdminRole) ?? null
}
