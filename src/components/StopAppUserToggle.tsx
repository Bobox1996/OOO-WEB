'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface StopAppUserToggleProps {
  userId: string
  userEmail: string
  isStopped: boolean
}

export default function StopAppUserToggle({ userId, userEmail, isStopped }: StopAppUserToggleProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [updating, setUpdating] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleToggle = async () => {
    setUpdating(true)
    
    const { error } = await supabase
      .from('app_users')
      .update({ stopped: !isStopped })
      .eq('id', userId)

    if (!error) {
      router.refresh()
    }
    setUpdating(false)
    setShowConfirm(false)
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-white/95 flex items-center justify-center z-50">
        <div className="max-w-md w-full mx-4 border border-black p-8">
          <h3 className="text-lg font-semibold mb-2 uppercase tracking-wider">
            {isStopped ? 'Resume Access?' : 'Stop Access?'}
          </h3>
          <p className="text-neutral-600 mb-8">
            {isStopped 
              ? `Are you sure you want to restore access for "${userEmail}"? They will be able to log in again.`
              : `Are you sure you want to stop access for "${userEmail}"? They will be logged out and unable to access the APP.`
            }
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-3 border border-black/30 text-neutral-500 text-sm uppercase tracking-widest hover:border-black hover:text-black transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleToggle}
              disabled={updating}
              className={`flex-1 py-3 text-white text-sm uppercase tracking-widest transition-colors disabled:opacity-50 ${
                isStopped 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {updating ? 'Updating...' : (isStopped ? 'Resume' : 'Stop')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className={`px-4 py-2 border text-xs uppercase tracking-widest transition-colors ${
        isStopped
          ? 'border-green-600 text-green-600 hover:bg-green-600 hover:text-white'
          : 'border-red-600 text-red-600 hover:bg-red-600 hover:text-white'
      }`}
    >
      {isStopped ? 'Resume' : 'Stop'}
    </button>
  )
}
