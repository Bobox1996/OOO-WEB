import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import HomePageClient from '@/components/HomePageClient'
import SwimmingTitle from '@/components/SwimmingTitle'

export default async function HomePage() {
  const supabase = await createClient()
  
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      *,
      images (id, url, filename)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black/10">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            OOO
          </Link>
          <nav className="flex items-center gap-8">
            <Link href="/" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
              Works
            </Link>
            <Link href="/team" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
              Team
            </Link>
            <Link href="/vision" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
              Vision
            </Link>
          </nav>
        </div>
      </header>

      <HomePageClient>
        {/* Projects Grid */}
        <section className="relative z-30 bg-white px-6 pb-24">
        <div className="max-w-screen-2xl mx-auto">
          {projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-black/10">
              {projects.map((project, index) => (
                <Link
                  key={project.id}
                  href={`/project/${project.id}`}
                  className="group bg-white"
                >
                  {/* Image */}
                  <div className="aspect-[4/3] bg-neutral-100 img-zoom relative">
                    {(() => {
                      // Find cover image or fall back to first image
                      const coverImage = project.cover_image_id 
                        ? project.images?.find((img: { id: string }) => img.id === project.cover_image_id)
                        : null
                      const displayImage = coverImage || project.images?.[0]
                      
                      if (displayImage) {
                        return (
                          <img
                            src={displayImage.url}
                            alt={project.title}
                            className="w-full h-full object-cover"
                          />
                        )
                      }
                      return (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300">
                          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )
                    })()}
                    {/* Title Overlay */}
                    <SwimmingTitle title={project.title} />
                  </div>
                  
                  {/* Info */}
                  <div className="p-6 border-t border-black/10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold tracking-tight group-hover:opacity-50 transition-opacity">
                          {project.index || project.title}
                        </h2>
                        {project.category && (
                          <p className="text-sm text-neutral-500 mt-1 uppercase tracking-wider">
                            {project.category}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-neutral-400 tabular-nums">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center border border-black/10">
              <p className="text-neutral-500 uppercase tracking-wider text-sm">No projects yet</p>
            </div>
          )}
        </div>
      </section>
      </HomePageClient>

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
