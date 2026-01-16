import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/AdminNav'
import Link from 'next/link'
import DeleteProjectButton from '@/components/DeleteProjectButton'

export default async function ProjectsPage() {
  const supabase = await createClient()
  
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      *,
      images (id, url, filename)
    `)
    .order('created_at', { ascending: false })

  return (
    <>
      <AdminNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="flex items-end justify-between mb-12">
            <div>
              <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
                Projects
              </h1>
              <p className="text-neutral-500 mt-4 text-lg">Manage your portfolio</p>
            </div>
            <Link
              href="/admin/upload"
              className="px-6 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors"
            >
              + New Project
            </Link>
          </div>

          {/* Projects Grid */}
          {projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-black/10">
              {projects.map((project, index) => (
                <div key={project.id} className="bg-white">
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] bg-neutral-100">
                    {project.images && project.images.length > 0 ? (
                      <img
                        src={project.images[0].url}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-300">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-6 border-t border-black/10">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="font-semibold">{project.title}</h3>
                        <p className="text-sm text-neutral-500 mt-1">
                          {project.category || 'Uncategorized'} · {project.images?.length || 0} images
                        </p>
                      </div>
                      <span className="text-sm text-neutral-400 tabular-nums">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/projects/${project.id}`}
                        className="flex-1 py-2 text-center border border-black text-black text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                      >
                        Edit
                      </Link>
                      <DeleteProjectButton projectId={project.id} projectTitle={project.title} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-black/10 p-16 text-center">
              <p className="text-neutral-500 mb-6">No projects yet</p>
              <Link
                href="/admin/upload"
                className="inline-block px-6 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors"
              >
                Create First Project
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
