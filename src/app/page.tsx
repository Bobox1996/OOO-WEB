import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import HomePageClient from '@/components/HomePageClient'
import SiteHeader from '@/components/SiteHeader'

// Use ISR with 60 second revalidation for better caching
// Shuffle is handled client-side for random order on each visit
export const revalidate = 60

export default async function HomePage() {
  const supabase = await createClient()
  
  // Optimized query: only fetch fields needed for display
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, index, category, cover_image_id, images(id, url)')
    .eq('hidden', false)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Client component handles shuffle and project grid */}
      <HomePageClient projects={projects || []} />

      {/* Footer */}
      <footer className="border-t border-black/10 px-6 py-8">
        <div className="max-w-screen-2xl mx-auto flex flex-col items-center gap-4 md:flex-row md:justify-between md:gap-0">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} OOO
          </p>
          <div className="flex flex-col items-center gap-2 md:flex-row md:gap-8">
            <a 
              href="mailto:office@out-of-office.design" 
              className="text-sm text-neutral-500 hover:opacity-50 transition-opacity"
            >
              E-MAIL: office@out-of-office.design
            </a>
            <p className="text-sm text-neutral-500 uppercase tracking-wider">
              Architecture & Design
            </p>
            <Link 
              href="/admin/login" 
              className="text-sm text-neutral-400 hover:text-neutral-600 transition-opacity uppercase tracking-widest"
            >
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
