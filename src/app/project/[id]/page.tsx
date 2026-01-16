import { createClient } from '@/lib/supabase/server'
import { createStaticClient } from '@/lib/supabase/static'
import Link from 'next/link'
import ProjectImages from './ProjectImages'

// 启用 ISR - 每 60 秒重新生成页面
export const revalidate = 60

// 生成静态路径（使用不依赖 cookies 的客户端）
export async function generateStaticParams() {
  const supabase = createStaticClient()
  const { data: projects } = await supabase.from('projects').select('id')
  
  return (projects || []).map((project) => ({
    id: project.id,
  }))
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()

  const { data: images } = await supabase
    .from('images')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  if (!project) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Project not found</h1>
          <Link href="/" className="text-sm uppercase tracking-wider hover:opacity-50 transition-opacity">
            ← Back
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black/10">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            OOO
          </Link>
          <Link href="/" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
            ← Back
          </Link>
        </div>
      </header>

      {/* Project Header */}
      <section className="pt-32 pb-12 px-6 border-b border-black/10">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[0.95] tracking-tighter uppercase">
                {project.title}
              </h1>
            </div>
            <div className="flex flex-col justify-end">
              {project.category && (
                <p className="text-sm uppercase tracking-wider text-neutral-500 mb-2">
                  {project.category}
                </p>
              )}
              {project.description && (
                <p className="text-lg leading-relaxed text-neutral-600">
                  {project.description}
                </p>
              )}
              <p className="text-sm text-neutral-400 mt-6">
                {new Date(project.created_at).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long'
                })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Images Grid */}
      <ProjectImages images={images || []} />

      {/* Footer */}
      <footer className="border-t border-black/10 px-6 py-8">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} OOO
          </p>
          <Link href="/" className="text-sm uppercase tracking-wider hover:opacity-50 transition-opacity">
            All Projects
          </Link>
        </div>
      </footer>
    </div>
  )
}
