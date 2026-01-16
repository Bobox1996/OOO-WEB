import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/AdminNav'
import Link from 'next/link'

// Admin 页面不缓存，始终获取最新数据
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { count: projectCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
  
  const { count: imageCount } = await supabase
    .from('images')
    .select('*', { count: 'exact', head: true })

  const { data: recentProjects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <>
      <AdminNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              Dashboard
            </h1>
            <p className="text-neutral-500 mt-4 text-lg">Portfolio overview</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-black/10 mb-12">
            <div className="bg-white p-8">
              <p className="text-sm uppercase tracking-wider text-neutral-500 mb-2">Projects</p>
              <p className="text-5xl font-bold tracking-tight">{projectCount || 0}</p>
            </div>
            <div className="bg-white p-8">
              <p className="text-sm uppercase tracking-wider text-neutral-500 mb-2">Images</p>
              <p className="text-5xl font-bold tracking-tight">{imageCount || 0}</p>
            </div>
            <div className="bg-white p-8">
              <p className="text-sm uppercase tracking-wider text-neutral-500 mb-4">Quick Actions</p>
              <div className="flex gap-4">
                <Link
                  href="/admin/upload"
                  className="px-6 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors"
                >
                  Upload
                </Link>
                <Link
                  href="/admin/projects"
                  className="px-6 py-3 border border-black text-black text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                >
                  Manage
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Projects */}
          <div>
            <h2 className="text-xl font-semibold tracking-tight mb-6 uppercase">Recent Projects</h2>
            {recentProjects && recentProjects.length > 0 ? (
              <div className="border border-black/10">
                {recentProjects.map((project, index) => (
                  <Link
                    key={project.id}
                    href={`/admin/projects/${project.id}`}
                    className="flex items-center justify-between p-6 border-b border-black/10 last:border-b-0 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-6">
                      <span className="text-sm text-neutral-400 tabular-nums w-8">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className="font-medium">{project.title}</p>
                        <p className="text-sm text-neutral-500">
                          {project.category || 'Uncategorized'} · {new Date(project.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-neutral-400 uppercase tracking-wider">
                      Edit →
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="border border-black/10 p-12 text-center">
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
        </div>
      </main>
    </>
  )
}
