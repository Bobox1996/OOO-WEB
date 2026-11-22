import Image from '@/components/sections/PortfolioImage'
import Link from 'next/link'
import StudioIntro from '@/components/sections/StudioIntro'
import { createClient } from '@/services/supabase/server'
import { folio } from '@/lib/portfolio'
import type { TeamMember, TeamDescription } from '@/types'

export const metadata = { title: 'Team | Out Of Office Design' }

export default async function TeamPage() {
  const supabase = await createClient()
  const [people, intro] = await Promise.all([
    supabase.from('team_members').select('*').order('created_at', { ascending: true }),
    supabase.from('team_description').select('content').limit(1).maybeSingle(),
  ])
  const members = (people.data || []) as TeamMember[]
  const description = intro.data as Pick<TeamDescription, 'content'> | null
  return <main className="folio-page"><Link className="back-link" href="/">← Project index</Link>
    <StudioIntro title="Team" count={members.length} content={description?.content} />
    {members.length > 0 && <section className="studio-spread member-directory" aria-labelledby="members-title">
      <h2 id="members-title">Members</h2>
      <div className="members">
        {members.map((member, i) => <details className="member" key={member.id}>
          <summary><small>{folio(i)}</small><span>{member.first_name} {member.last_name}</span></summary>
          <div className="member-content">
            {member.portrait_url && <Image src={member.portrait_url} alt={member.first_name + ' ' + member.last_name} width={420} height={520} sizes="(max-width: 760px) 25vw, 144px" />}
            {member.description && <p>{member.description}</p>}
          </div>
        </details>)}
      </div>
    </section>}
    {people.error && <p className="catalog-empty">The team directory could not be loaded. Please refresh to try again.</p>}
  </main>
}
