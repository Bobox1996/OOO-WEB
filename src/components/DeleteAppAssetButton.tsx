'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const BUCKET_NAME = 'app-assets'

interface DeleteAppAssetButtonProps {
  assetId: string
  assetFilename: string
  imageUrl: string
}

export default function DeleteAppAssetButton({ assetId, assetFilename, imageUrl }: DeleteAppAssetButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleDelete = async () => {
    setDeleting(true)
    
    try {
      // Extract filename from URL to delete from storage
      const urlParts = imageUrl.split('/')
      const storagePath = urlParts[urlParts.length - 1]
      
      // Delete from storage (ignore errors if file doesn't exist)
      await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath])
      
      // Delete from database
      const { error } = await supabase
        .from('app_assets')
        .delete()
        .eq('id', assetId)

      if (!error) {
        router.refresh()
      }
    } catch (err) {
      console.error('Delete error:', err)
    }
    
    setDeleting(false)
    setShowConfirm(false)
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-white/95 flex items-center justify-center z-50">
        <div className="max-w-md w-full mx-4 border border-black p-8">
          <h3 className="text-lg font-semibold mb-2 uppercase tracking-wider">Delete Asset?</h3>
          <p className="text-neutral-600 mb-8">
            Are you sure you want to delete &quot;{assetFilename}&quot;? This action cannot be undone.
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
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex-1 px-4 py-3 text-center text-xs uppercase tracking-widest text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors"
    >
      Delete
    </button>
  )
}
