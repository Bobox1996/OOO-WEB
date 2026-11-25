import { randomInt } from 'node:crypto'
import { createClient } from '@/services/supabase/server'
import HomePageClient from '@/components/sections/HomePageClient'
import ImageArchive from '@/components/sections/ImageArchive'
import { makeCatalog } from '@/lib/portfolio'

export default async function HomePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('projects')
    .select('*, images(id, url, sort_order)').eq('hidden', false)
    .order('created_at', { ascending: false })
  const projects = makeCatalog(data || [])

  return <HomePageClient projects={projects} unavailable={Boolean(error)}>
    <ImageArchive projects={projects} seed={randomInt(0x100000000)} />
  </HomePageClient>
}
