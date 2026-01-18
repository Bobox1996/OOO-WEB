export interface Project {
  id: string
  index: string | null
  title: string
  description: string | null
  category: string | null
  cover_image_id: string | null
  created_at: string
}

export interface Image {
  id: string
  project_id: string
  url: string
  filename: string
  sort_order: number
  created_at: string
}

export interface TeamMember {
  id: string
  first_name: string
  last_name: string
  portrait_url: string | null
  description: string | null
  created_at: string
}

export interface VisionContent {
  id: string
  content: string
  updated_at: string
  updated_by: string | null
}

export interface TeamDescription {
  id: string
  content: string
  updated_at: string
  updated_by: string | null
}
