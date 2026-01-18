'use client'

import { useState, useEffect, useRef, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import { useRouter } from 'next/navigation'
import type { TeamMember } from '@/lib/types'

const BUCKET_NAME = 'drawings'

export default function TeamMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [member, setMember] = useState<TeamMember | null>(null)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({ first_name: '', last_name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [portraitFile, setPortraitFile] = useState<File | null>(null)
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null)
  const [uploadingPortrait, setUploadingPortrait] = useState(false)
  const [removingPortrait, setRemovingPortrait] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchMember()
  }, [id])

  const fetchMember = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('id', id)
      .single()

    if (data) {
      setMember(data as TeamMember)
      setFormData({
        first_name: data.first_name,
        last_name: data.last_name,
        description: data.description || '',
      })
    }
  }

  const updateMember = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('team_members')
      .update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        description: formData.description || null,
      })
      .eq('id', id)

    if (!error) {
      setMember({ ...member!, ...formData })
      setEditing(false)
    }
    setSaving(false)
  }

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

  const uploadPortrait = async () => {
    if (!portraitFile) return

    setUploadingPortrait(true)
    try {
      const fileExt = portraitFile.name.split('.').pop()
      const fileName = `portraits/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, portraitFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('team_members')
        .update({ portrait_url: publicUrl })
        .eq('id', id)

      if (updateError) throw updateError

      setMember({ ...member!, portrait_url: publicUrl })
      setPortraitFile(null)
      setPortraitPreview(null)
    } catch (err) {
      console.error('Portrait upload failed:', err)
    } finally {
      setUploadingPortrait(false)
    }
  }

  const removePortrait = async () => {
    if (!member?.portrait_url) return

    setRemovingPortrait(true)
    try {
      const { error: updateError } = await supabase
        .from('team_members')
        .update({ portrait_url: null })
        .eq('id', id)

      if (updateError) throw updateError

      setMember({ ...member!, portrait_url: null })
    } catch (err) {
      console.error('Portrait removal failed:', err)
    } finally {
      setRemovingPortrait(false)
    }
  }

  if (!member) {
    return (
      <>
        <AdminNav />
        <main className="pt-24 px-6">
          <div className="text-center text-neutral-500">Loading...</div>
        </main>
      </>
    )
  }

  return (
    <>
      <AdminNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-12">
            <button
              onClick={() => router.back()}
              className="text-sm uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
            >
              ← Back
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Sidebar - Info */}
            <div className="lg:col-span-1">
              <div className="border border-black/10 p-6 sticky top-24">
                {editing ? (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">First Name</label>
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="First name"
                        className="w-full px-3 py-3 bg-neutral-50 border border-black/20 text-black placeholder-neutral-400 focus:outline-none focus:border-black focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">Last Name</label>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Last name"
                        className="w-full px-3 py-3 bg-neutral-50 border border-black/20 text-black placeholder-neutral-400 focus:outline-none focus:border-black focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={4}
                        placeholder="Brief bio or role description..."
                        className="w-full px-3 py-3 bg-neutral-50 border border-black/20 text-black placeholder-neutral-400 focus:outline-none focus:border-black focus:bg-white resize-none"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={updateMember}
                        disabled={saving}
                        className="flex-1 py-3 bg-black text-white text-xs uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="flex-1 py-3 border border-black/30 text-neutral-500 text-xs uppercase tracking-widest hover:border-black hover:text-black transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between mb-6">
                      <h1 className="text-2xl font-bold tracking-tight">
                        {member.first_name} {member.last_name}
                      </h1>
                      <button
                        onClick={() => setEditing(true)}
                        className="text-xs uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                    {member.description ? (
                      <p className="text-neutral-600 mb-6 whitespace-pre-wrap">{member.description}</p>
                    ) : (
                      <p className="text-neutral-400 italic mb-6">No description yet</p>
                    )}
                    <div className="text-sm text-neutral-400 pt-4 border-t border-black/10">
                      <p>Added {new Date(member.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Portrait Section */}
            <div className="lg:col-span-2">
              <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-6">
                Portrait
              </h2>

              {/* Current Portrait */}
              <div className="border border-black/10 mb-6">
                <div className="aspect-[3/4] bg-neutral-100 relative group">
                  {member.portrait_url ? (
                    <>
                      <img
                        src={member.portrait_url}
                        alt={`${member.first_name} ${member.last_name}`}
                        className="w-full h-full object-cover"
                      />
                      {/* Remove Portrait Button */}
                      <button
                        onClick={removePortrait}
                        disabled={removingPortrait}
                        className="absolute top-4 right-4 px-4 py-2 bg-white/90 text-black text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black hover:text-white disabled:opacity-50"
                      >
                        {removingPortrait ? 'Removing...' : 'Remove'}
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-300">
                      <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload New Portrait */}
              <div className="border border-black/10 p-6">
                <h3 className="text-sm uppercase tracking-wider text-neutral-500 mb-4">
                  {member.portrait_url ? 'Replace Portrait' : 'Upload Portrait'}
                </h3>
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
                        alt="New portrait preview"
                        className="w-32 h-32 object-cover rounded-full"
                      />
                      <p className="text-sm text-neutral-500">Click to change selection</p>
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

                {portraitFile && (
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={uploadPortrait}
                      disabled={uploadingPortrait}
                      className="flex-1 py-3 bg-black text-white text-xs uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50"
                    >
                      {uploadingPortrait ? 'Uploading...' : 'Upload Portrait'}
                    </button>
                    <button
                      onClick={() => {
                        setPortraitFile(null)
                        setPortraitPreview(null)
                      }}
                      className="px-6 py-3 border border-black/30 text-neutral-500 text-xs uppercase tracking-widest hover:border-black hover:text-black transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
