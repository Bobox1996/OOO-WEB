import Link from 'next/link'
import { createClient } from '@/services/supabase/server'

export const metadata = { title: 'Vision | Out Of Office Design' }

export default async function VisionPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('vision_content').select('content').limit(1).maybeSingle()
  return <main className="folio-page"><Link className="back-link" href="/">← Project index</Link>
    <div className="folio-heading"><h1>Vision</h1></div>
    {data?.content && <p className="studio-copy">{data.content}</p>}
    {error && <p className="catalog-empty">The studio statement could not be loaded. Please refresh to try again.</p>}
  </main>
}
