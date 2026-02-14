import { createClient } from '@/services/supabase/server'
import { notFound } from 'next/navigation'
import EditAppAssetForm from '@/components/admin/EditAppAssetForm'
import type { AppAsset } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditAssetPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: asset, error } = await supabase
    .from('app_assets')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !asset) {
    notFound()
  }

  return <EditAppAssetForm asset={asset as AppAsset} />
}
