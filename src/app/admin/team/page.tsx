import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/AdminNav'
import Link from 'next/link'
import DeleteTeamMemberButton from '@/components/DeleteTeamMemberButton'
import TeamDescriptionEditor from '@/components/TeamDescriptionEditor'
import type { TeamMember, TeamDescription } from '@/lib/types'

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
    <>
      <AdminNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="flex items-end justify-between mb-12">
            <div>
              <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
                Team
              </h1>
              <p className="text-neutral-500 mt-4 text-lg">Manage team members</p>
            </div>
            <Link
              href="/admin/team/new"
              className="px-6 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors"
            >
              + New Member
            </Link>
          </div>

          {/* About This Team */}
          <TeamDescriptionEditor initialDescription={teamDescription} />

          {/* Team Grid */}
          {teamMembers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-black/10">
              {teamMembers.map((member, index) => (
                <div key={member.id} className="bg-white">
                  {/* Portrait */}
                  <div className="aspect-[4/3] bg-neutral-100">
                    {member.portrait_url ? (
                      <img
                        src={member.portrait_url}
                        alt={`${member.first_name} ${member.last_name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-300">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-6 border-t border-black/10">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="font-semibold">{member.first_name} {member.last_name}</h3>
                        {member.description && (
                          <p className="text-sm text-neutral-500 mt-1 line-clamp-2 whitespace-pre-wrap">
                            {member.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-neutral-400 tabular-nums">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/team/${member.id}`}
                        className="flex-1 py-2 text-center border border-black text-black text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                      >
                        Edit
                      </Link>
                      <DeleteTeamMemberButton 
                        memberId={member.id} 
                        memberName={`${member.first_name} ${member.last_name}`} 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-black/10 p-16 text-center">
              <p className="text-neutral-500 mb-6">No team members yet</p>
              <Link
                href="/admin/team/new"
                className="inline-block px-6 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors"
              >
                Add First Member
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
