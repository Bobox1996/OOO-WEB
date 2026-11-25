import type { Image, Project } from '@/types'
import { projectDate } from './portfolio'

export type DetailImage = Pick<Image, 'id' | 'url' | 'sort_order' | 'side_by_side'>
export type ProjectDetail = {
  description: string | null
  year: string
  yearIsFiled: boolean
  team: string | null
  images: DetailImage[]
}
export type ProjectDetails = Record<string, ProjectDetail>

export function makeProjectDetails(projects: (Project & { images: DetailImage[] })[]): ProjectDetails {
  return Object.fromEntries(projects.map(project => [project.id, {
    ...projectDate(project),
    description: project.description,
    team: project.team,
    images: [...(project.images || [])].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)),
  }]))
}
