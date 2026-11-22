import type { Project, Image } from '@/types'

type CatalogImage = Pick<Image, 'id' | 'url' | 'sort_order'>
export type CatalogProject = Pick<Project, 'id' | 'index' | 'title' | 'category'> & {
  year: string
  yearIsFiled: boolean
  images: CatalogImage[]
  cover: CatalogImage | null
}

export function projectDate(project: Project) {
  const documented = project.description?.match(/(?:^|\n)\s*(?:project year|year|年份|完成年份)\s*[:：]\s*((?:19|20)\d{2})\b/i)?.[1]
  const year = project.project_year || documented
  return { year: String(year || project.created_at?.slice(0, 4) || '—'), yearIsFiled: !year }
}

export function makeCatalog(projects: (Project & { images: CatalogImage[] })[]): CatalogProject[] {
  return projects.map(project => {
    const images = [...(project.images || [])].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    return {
      id: project.id, index: project.index?.trim() || null, title: project.title.trim(),
      category: project.category, ...projectDate(project), images,
      cover: images.find(image => image.id === project.cover_image_id) || images[0] || null,
    }
  }).sort((a, b) => {
    if (a.index && b.index) return a.index.localeCompare(b.index, 'en', { numeric: true }) || a.title.localeCompare(b.title)
    return Number(!a.index) - Number(!b.index)
  })
}

export const folio = (n: number) => String(n + 1).padStart(2, '0')
