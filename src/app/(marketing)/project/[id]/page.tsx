import { cache } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/services/supabase/server'
import { projectDate } from '@/lib/portfolio'
import ProjectPageClient from '@/components/sections/ProjectPageClient'
import type { Project, Image } from '@/types'

type Props = { params: Promise<{ id: string }> }
const getProject = cache(async (id: string) => {
  const supabase = await createClient()
  const { data } = await supabase.from('projects').select('*, images(*)').eq('id', id).single()
  return data as (Project & { images: Image[] }) | null
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject((await params).id)
  return { title: project ? project.title + ' | Out Of Office Design' : 'Project not found | OOO',
    description: project?.description || undefined }
}

export default async function ProjectPage({ params }: Props) {
  const project = await getProject((await params).id)
  if (!project) notFound()
  const images = [...(project.images || [])].sort((a, b) => a.sort_order - b.sort_order)
  const date = projectDate(project)
  return <main className="folio-page"><Link className="back-link" href="/works">← Project index</Link>
    <div className="folio-heading"><h1>{project.title}</h1>{project.index && <span>{project.index}</span>}</div>
    <dl className="project-facts"><div><dt>{date.yearIsFiled ? 'Year filed' : 'Year'}</dt><dd>{date.year}</dd></div>
      {project.category && <div><dt>Type</dt><dd>{project.category}</dd></div>}
      {project.team && <div><dt>Team</dt><dd>{project.team}</dd></div>}
    </dl>
    <ProjectPageClient images={images} title={project.title} description={project.description} />
  </main>
}
