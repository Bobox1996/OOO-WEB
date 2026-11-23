import { createClient } from '@/services/supabase/server'
import DriveIn from '@/components/drive-in/DriveIn'
import { makeCatalog } from '@/lib/portfolio'

export default async function HomePage() {
  const supabase = await createClient()
  const [films, people, statement, team] = await Promise.all([
    supabase.from('projects').select('*, images(id, url, sort_order)').eq('hidden', false)
      .order('created_at', { ascending: false }),
    supabase.from('team_members').select('id,first_name,last_name,portrait_url,description')
      .order('created_at', { ascending: true }),
    supabase.from('vision_content').select('content').limit(1).maybeSingle(),
    supabase.from('team_description').select('content').limit(1).maybeSingle(),
  ])
  const projects = makeCatalog(films.data || []).map(({id,index,title,category,cover}) => ({id,index,title,category,cover}))
  return <DriveIn projects={projects} members={people.data || []} vision={statement.data?.content}
    intro={team.data?.content} unavailable={Boolean(films.error)} />
}
