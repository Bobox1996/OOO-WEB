import { createClient } from '@/lib/supabase/server'
import TeamPageClient from '@/components/TeamPageClient'
import type { TeamMember, TeamDescription } from '@/lib/types'

const O_COUNT = 4000

export default async function TeamPage() {
  const supabase = await createClient()
  
  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: true })

  const { data: descriptionData } = await supabase
    .from('team_description')
    .select('*')
    .limit(1)
    .single()

  const teamMembers = (members as TeamMember[]) || []
  const teamDescription = (descriptionData as TeamDescription) || null

  return (
    <div className="h-screen overflow-hidden bg-white">
      {/* Client component handles header, scroll-synced title and O-field */}
      <TeamPageClient oCount={O_COUNT} members={teamMembers} teamDescription={teamDescription} />
    </div>
  )
}
