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
  slogan_font: string | null
  slogan_weight: number | null
  slogan_color: string | null
  weight_random: boolean
  rotation_random: number
  position_random: number
  random_seed: number
  logo_url: string | null
  logo_fill_color: string | null
  logo_stroke_color: string | null
  logo_stroke_width: number | null
  svg_preview: string
  pinned: boolean
  created_at: string
}

export interface AppMetaballPattern {
  id: string
  user_id: string
  total_points: number
  charge_count: number
  seed: number
  accuracy: number
  stroke_weight: number
  stroke_color: string
  fill_set_index: number
  fill_color: string
  logo_url: string | null
  logo_fill_color: string | null
  logo_stroke_color: string | null
  logo_stroke_width: number | null
  svg_preview: string
  pinned: boolean
  created_at: string
}

export interface AppAsawaPattern {
  id: string
  user_id: string
  columns: number
  rows: number
  stroke_weight: number
  stroke_color: string
  rotation_random: number
  position_random: number
  random_seed: number
  logo_url: string | null
  logo_fill_color: string | null
  logo_stroke_color: string | null
  logo_stroke_width: number | null
  fill_opacity_random: boolean
  svg_preview: string
  pinned: boolean
  created_at: string
}

export interface AppUserLogo {
  id: string
  user_id: string
  image_url: string
  filename: string
  created_at: string
}

export interface AppPixelizerPattern {
  id: string
  user_id: string
  resolution: number
  svg_preview: string
  pinned: boolean
  created_at: string
}

export interface AppColorThemerConfig {
  id: string
  prompt_template: string
  updated_at: string
}
