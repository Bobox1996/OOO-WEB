import { createClient } from '@/lib/supabase/server'
import VisionPageClient from '@/components/VisionPageClient'
import type { VisionContent } from '@/lib/types'

const O_COUNT = 4000

export default async function VisionPage() {
  const supabase = await createClient()
  
  const { data: visionData } = await supabase
    .from('vision_content')
    .select('*')
    .limit(1)
    .single()

  const vision = visionData as VisionContent | null
  const visionContent = vision?.content || ''

  return (
    <div className="h-screen overflow-hidden bg-white">
      {/* Client component handles header, scroll-synced title and O-field */}
      <VisionPageClient oCount={O_COUNT} visionContent={visionContent} />
    </div>
  )
}
