export interface Project {
  id: string
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

export interface ProjectWithImages extends Project {
  images: Image[]
}

export interface TeamMember {
  id: string
  first_name: string
  last_name: string
  portrait_url: string | null
  description: string | null
  created_at: string
}
