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
