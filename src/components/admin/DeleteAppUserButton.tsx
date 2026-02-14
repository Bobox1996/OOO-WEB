'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface DeleteAppUserButtonProps {
  userId: string
  userEmail: string
}

export default function DeleteAppUserButton({ userId, userEmail }: DeleteAppUserButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    setDeleting(true)
    
    const { error } = await supabase
      .from('app_users')
      .delete()
      .eq('id', userId)

    if (!error) {
      router.refresh()
    }
    setDeleting(false)
    setShowConfirm(false)
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-white/95 flex items-center justify-center z-50">
        <div className="max-w-md w-full mx-4 border border-black p-8">
          <h3 className="text-lg font-semibold mb-2 uppercase tracking-wider">Remove APP User?</h3>
          <p className="text-neutral-600 mb-8">
            Are you sure you want to remove &quot;{userEmail}&quot; from APP users? They will no longer be able to access the APP.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-3 border border-black/30 text-neutral-500 text-sm uppercase tracking-widest hover:border-black hover:text-black transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="px-4 py-2 border border-black/20 text-neutral-400 text-xs uppercase tracking-widest hover:border-black hover:text-black transition-colors"
    >
      Delete
    </button>
  )
}
