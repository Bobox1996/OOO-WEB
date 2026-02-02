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

export interface AppUser {
  id: string
  email: string
  name: string | null
  stopped: boolean
  created_at: string
}

export interface AdminUser {
  id: string
  email: string
  created_at: string
}

export interface AppAsset {
  id: string
  image_url: string
  filename: string
  category: string
  prompt: string
  created_at: string
}

export interface AppPattern {
  id: string
  user_id: string
  columns: number
  rows: number
  stroke_weight: number
  stroke_color: string
  slogan: string | null
  slogan_weight: number | null
  slogan_color: string | null
  svg_preview: string
  pinned: boolean
  created_at: string
}
