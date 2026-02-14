export interface TeamMember {
  id: string
  first_name: string
  last_name: string
  portrait_url: string | null
  description: string | null
  created_at: string
}

export interface TeamDescription {
  id: string
  content: string
  updated_at: string
  updated_by: string | null
}
