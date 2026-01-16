import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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
              Projects
            </Link>
            <Link href="/admin/login" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-screen-2xl mx-auto">
          <h1 className="text-[clamp(3rem,10vw,8rem)] font-bold leading-[0.9] tracking-tighter uppercase">
            Selected
            <br />
            Works
          </h1>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="px-6 pb-24">
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
                  <div className="aspect-[4/3] bg-neutral-100 img-zoom">
                    {project.images && project.images.length > 0 ? (
                      <img
                        src={project.images[0].url}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-300">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="p-6 border-t border-black/10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold tracking-tight group-hover:opacity-50 transition-opacity">
                          {project.title}
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

      {/* Footer */}
      <footer className="border-t border-black/10 px-6 py-8">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} OOO
          </p>
          <p className="text-sm text-neutral-500 uppercase tracking-wider">
            Architecture & Design
          </p>
        </div>
      </footer>
    </div>
  )
}
