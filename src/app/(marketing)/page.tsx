import { createClient } from '@/services/supabase/server'
import Sumiyoshi from '@/components/sumiyoshi/Sumiyoshi'
import { makeCatalog } from '@/lib/portfolio'
import { makeProjectDetails } from '@/lib/sumiyoshi-projects'

export default async function HomePage() {
  const [snapshot, savedArticles] = process.env.NODE_ENV === 'development'
    ? await Promise.all([
      import('@/lib/drive-in-snapshot.json').then(module => module.default),
      import('@/lib/sumiyoshi-project-snapshot.json').then(module => module.default),
    ])
    : [null, null]
  if (snapshot && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return <Sumiyoshi projects={snapshot.projects} projectDetails={savedArticles || {}} members={snapshot.members}
      vision={snapshot.vision} intro={snapshot.intro} unavailable={false} />
  }

  const supabase = await createClient()
  const projectQuery = supabase.from('projects').select('*, images(id, url, sort_order, side_by_side)').eq('hidden', false)
    .order('created_at', { ascending: false })
  const memberQuery = supabase.from('team_members').select('id,first_name,last_name,portrait_url,description')
    .order('created_at', { ascending: true })
  const visionQuery = supabase.from('vision_content').select('content').limit(1)
  const introQuery = supabase.from('team_description').select('content').limit(1)
  if (snapshot) {
    const deadline = AbortSignal.timeout(2500)
    for (const query of [projectQuery, memberQuery, visionQuery, introQuery]) query.abortSignal(deadline)
  }
  const [films, people, statement, team] = await Promise.all([
    projectQuery, memberQuery, visionQuery.maybeSingle(), introQuery.maybeSingle(),
  ])
  const projects = films.error && snapshot ? snapshot.projects :
    makeCatalog(films.data || []).map(({ id,index,title,category,cover }) => ({ id,index,title,category,cover }))
  const projectDetails = films.error && savedArticles ? savedArticles : makeProjectDetails(films.data || [])
  return <Sumiyoshi projects={projects} projectDetails={projectDetails} members={people.error && snapshot ? snapshot.members : people.data || []}
    vision={statement.error && snapshot ? snapshot.vision : statement.data?.content ?? null}
    intro={team.error && snapshot ? snapshot.intro : team.data?.content ?? null}
    unavailable={Boolean(films.error && !snapshot)} />
}
