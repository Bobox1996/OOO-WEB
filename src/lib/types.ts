export interface Project {
  id: string
  title: string
  description: string | null
  category: string | null
  created_at: string
}

export interface Image {
  id: string
  project_id: string
  url: string
  filename: string
  created_at: string
}

export interface ProjectWithImages extends Project {
  images: Image[]
}
