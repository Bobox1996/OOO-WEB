'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import { useRouter } from 'next/navigation'

const BUCKET_NAME = 'drawings'

export default function NewTeamMemberPage() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    description: '',
  })
  const [portraitFile, setPortraitFile] = useState<File | null>(null)
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPortraitFile(file)
      setPortraitPreview(URL.createObjectURL(file))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'))
    if (file) {
      setPortraitFile(file)
      setPortraitPreview(URL.createObjectURL(file))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleSubmit = async () => {
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setError('First name and last name are required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      let portrait_url: string | null = null

      // Upload portrait if selected
      if (portraitFile) {
        const fileExt = portraitFile.name.split('.').pop()
        const fileName = `portraits/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(fileName, portraitFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(fileName)

        portrait_url = publicUrl
      }

      // Create team member record
      const { error: dbError } = await supabase
        .from('team_members')
        .insert({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          description: formData.description.trim() || null,
          portrait_url,
        })

      if (dbError) throw dbError

      router.push('/admin/team')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team member')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AdminNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-md mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-12">
            <button
              onClick={() => router.back()}
              className="text-sm uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
            >
              ← Back
            </button>
          </div>

          <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase mb-12">
            New Member
          </h1>

          {/* Portrait Upload */}
          <div className="border border-black/10 p-8 mb-8">
            <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-4">
              Portrait
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-black/20 p-8 text-center cursor-pointer hover:border-black transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              {portraitPreview ? (
                <div className="flex flex-col items-center gap-4">
                  <img
                    src={portraitPreview}
                    alt="Portrait preview"
                    className="w-32 h-32 object-cover rounded-full"
                  />
                  <p className="text-sm text-neutral-500">Click to change</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div>
                    <p className="font-medium">Drop portrait here or click to browse</p>
                    <p className="text-sm text-neutral-500 mt-1">JPG, PNG, GIF, WebP</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="border border-black/10 p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-0 py-3 bg-transparent border-0 border-b border-black text-black placeholder-neutral-400 focus:outline-none text-lg"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-0 py-3 bg-transparent border-0 border-b border-black text-black placeholder-neutral-400 focus:outline-none text-lg"
                  placeholder="Last name"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-0 py-3 bg-transparent border-0 border-b border-black/30 text-black placeholder-neutral-400 focus:outline-none focus:border-black text-lg resize-none"
                placeholder="Brief bio or role description..."
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="border border-black p-4 text-sm mt-8">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Member'}
            </button>
            <button
              onClick={() => router.back()}
              className="px-8 py-4 border border-black/30 text-neutral-500 text-sm uppercase tracking-widest hover:border-black hover:text-black transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
