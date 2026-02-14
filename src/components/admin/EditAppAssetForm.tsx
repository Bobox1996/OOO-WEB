'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { AppAsset } from '@/lib/types'

interface EditAppAssetFormProps {
  asset: AppAsset
}

export default function EditAppAssetForm({ asset }: EditAppAssetFormProps) {
  const [formData, setFormData] = useState({
    category: asset.category,
    prompt: asset.prompt,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async () => {
    if (!formData.category.trim()) {
      setError('Category is required')
      return
    }
    if (!formData.prompt.trim()) {
      setError('Prompt is required')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const { error: dbError } = await supabase
        .from('app_assets')
        .update({
          category: formData.category.trim(),
          prompt: formData.prompt.trim(),
        })
        .eq('id', asset.id)

      if (dbError) throw dbError

      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update asset')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/app/assets"
          className="text-sm uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
        >
          ← Back to Assets
        </Link>
      </div>

      <h2 className="text-2xl font-bold tracking-tight uppercase mb-8">
        Edit Asset
      </h2>

      <div className="max-w-screen-md space-y-8">
        {/* Image Preview */}
        <div className="border border-black/10 p-8">
          <p className="text-sm uppercase tracking-wider text-neutral-500 mb-4">Image</p>
          <div className="relative w-64 h-64 bg-neutral-100">
            <Image
              src={asset.image_url}
              alt={asset.filename}
              fill
              className="object-cover"
            />
          </div>
          <p className="text-sm text-neutral-400 mt-2">{asset.filename}</p>
          <p className="text-xs text-neutral-400 mt-1">
            To change the image, delete this asset and create a new one.
          </p>
        </div>

        {/* Form Fields */}
        <div className="border border-black/10 p-8 space-y-6">
          <div>
            <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
              Category *
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-0 py-3 bg-transparent border-0 border-b border-black text-black placeholder-neutral-400 focus:outline-none text-lg"
              placeholder="e.g., Patterns, Textures, Landscapes"
            />
          </div>
          <div>
            <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
              Prompt *
            </label>
            <textarea
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              rows={3}
              className="w-full px-0 py-3 bg-transparent border-0 border-b border-black text-black placeholder-neutral-400 focus:outline-none text-lg resize-none"
              placeholder="Describe the image style or content..."
            />
            <p className="text-sm text-neutral-400 mt-2">
              This prompt will be shown to users and can be used as a starting point for generation.
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="p-4 border border-black/10 bg-neutral-50">
          <p className="text-sm text-neutral-500">
            <strong>Added:</strong> {new Date(asset.created_at).toLocaleString()}
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="border border-green-500 bg-green-50 p-4 text-sm text-green-700">
            Asset updated successfully
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="border border-black p-4 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href="/admin/app/assets"
            className="px-8 py-4 border border-black/30 text-neutral-500 text-sm uppercase tracking-widest hover:border-black hover:text-black transition-colors text-center"
          >
            Cancel
          </Link>
        </div>
      </div>
    </>
  )
}
