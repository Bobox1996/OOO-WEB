import { createClient } from '@/lib/supabase/server'
import TeamPageClient from '@/components/TeamPageClient'
import type { TeamMember } from '@/lib/types'

const O_COUNT = 4000

export default async function TeamPage() {
  const supabase = await createClient()
  
  const { data: members } = await supabase
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: true })

  const teamMembers = (members as TeamMember[]) || []

  return (
    <div className="h-screen overflow-hidden bg-white">
      {/* Client component handles header, scroll-synced title and O-field */}
      <TeamPageClient oCount={O_COUNT} members={teamMembers} />
    </div>
  )
}
