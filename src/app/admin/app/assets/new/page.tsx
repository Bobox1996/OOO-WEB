'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const BUCKET_NAME = 'app-assets'

export default function NewAssetPage() {
  const [file, setFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    category: '',
    prompt: '',
  })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Create object URL for preview
  const previewUrl = useMemo(() => {
    return file ? URL.createObjectURL(file) : null
  }, [file])

  // Cleanup object URL when file changes or component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = Array.from(e.dataTransfer.files).find(f =>
      f.type.startsWith('image/')
    )
    if (droppedFile) {
      setFile(droppedFile)
      setError(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select an image to upload')
      return
    }
    if (!formData.category.trim()) {
      setError('Category is required')
      return
    }
    if (!formData.prompt.trim()) {
      setError('Prompt is required')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file)

      if (uploadError) {
        // If bucket doesn't exist, provide helpful error
        if (uploadError.message.includes('not found')) {
          throw new Error(`Storage bucket "${BUCKET_NAME}" not found. Please create it in Supabase Dashboard.`)
        }
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName)

      // Save to database
      const { error: dbError } = await supabase
        .from('app_assets')
        .insert({
          image_url: publicUrl,
          filename: file.name,
          category: formData.category.trim(),
          prompt: formData.prompt.trim(),
        })

      if (dbError) throw dbError

      router.push('/admin/app/assets')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload asset')
    } finally {
      setUploading(false)
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
        New Asset
      </h2>

      <div className="max-w-screen-md space-y-8">
        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-black/20 p-12 text-center cursor-pointer hover:border-black transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {previewUrl ? (
            <div className="space-y-4">
              <div className="relative w-48 h-48 mx-auto">
                <Image
                  src={previewUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
              </div>
              <p className="text-sm text-neutral-500">{file?.name}</p>
              <p className="text-xs text-neutral-400">Click to change image</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div>
                <p className="font-medium">Drop image here or click to browse</p>
                <p className="text-sm text-neutral-500 mt-1">JPG, PNG, GIF, WebP</p>
              </div>
            </div>
          )}
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
            disabled={uploading}
            className="flex-1 py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Add Asset'}
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
