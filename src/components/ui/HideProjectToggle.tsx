'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface HideProjectToggleProps {
  projectId: string
  projectTitle: string
  initialHidden: boolean
}

export default function HideProjectToggle({ projectId, projectTitle, initialHidden }: HideProjectToggleProps) {
  const [hidden, setHidden] = useState(initialHidden)
  const [updating, setUpdating] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleToggle = async () => {
    setUpdating(true)
    const newHidden = !hidden
    
    const { error } = await supabase
      .from('projects')
      .update({ hidden: newHidden })
      .eq('id', projectId)

    if (!error) {
      setHidden(newHidden)
      router.refresh()
    }
    setUpdating(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={updating}
      className={`px-3 py-2 text-xs uppercase tracking-widest transition-colors border ${
        hidden
          ? 'bg-black text-white border-black hover:bg-neutral-800'
          : 'border-black/20 text-neutral-400 hover:border-black hover:text-black'
      } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={hidden ? `Show "${projectTitle}" on homepage` : `Hide "${projectTitle}" from homepage`}
    >
      {updating ? '...' : hidden ? 'Hidden' : 'Hide'}
    </button>
  )
}
