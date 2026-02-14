export interface Project {
  id: string
  index: string | null
  title: string
  description: string | null
  category: string | null
  cover_image_id: string | null
  hidden: boolean
  team: string | null
  created_at: string
}

export interface Image {
  id: string
  project_id: string
  url: string
  filename: string
  sort_order: number
  side_by_side: boolean
  created_at: string
}
