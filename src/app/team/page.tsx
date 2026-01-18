import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
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
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black/10">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            OOO
          </Link>
          <nav className="flex items-center gap-8">
            <Link href="/" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
              Works
            </Link>
            <Link href="/team" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
              Team
            </Link>
            <Link href="/admin/login" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* Client component handles scroll-synced title and O-field */}
      <TeamPageClient oCount={O_COUNT} members={teamMembers} />
    </div>
  )
}
