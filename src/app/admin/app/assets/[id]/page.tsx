import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditAppAssetForm from './EditAppAssetForm'
import type { AppAsset } from '@/lib/types'

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
