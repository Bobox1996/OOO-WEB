'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import UploadForm from '@/components/UploadForm'
import { useRouter } from 'next/navigation'
import type { Project, Image } from '@/lib/types'

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [images, setImages] = useState<Image[]>([])
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({ title: '', description: '', category: '' })
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchProject()
  }, [id])

  const fetchProject = async () => {
    const { data: projectData } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (projectData) {
      setProject(projectData)
      setFormData({
        title: projectData.title,
        description: projectData.description || '',
        category: projectData.category || '',
      })
    }

    const { data: imagesData } = await supabase
      .from('images')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false })

    if (imagesData) setImages(imagesData)
  }

  const updateProject = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('projects')
      .update({
        title: formData.title,
        description: formData.description || null,
        category: formData.category || null,
      })
      .eq('id', id)

    if (!error) {
      setProject({ ...project!, ...formData })
      setEditing(false)
    }
    setSaving(false)
  }

  const deleteImage = async (imageId: string) => {
    const { error } = await supabase
      .from('images')
      .delete()
      .eq('id', imageId)

    if (!error) {
      setImages(images.filter(img => img.id !== imageId))
    }
  }

  if (!project) {
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
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="border border-black/10 p-6 sticky top-24">
                {editing ? (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-0 py-2 bg-transparent border-0 border-b border-black text-black focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">Category</label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-0 py-2 bg-transparent border-0 border-b border-black/30 text-black focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={4}
                        className="w-full px-0 py-2 bg-transparent border-0 border-b border-black/30 text-black focus:outline-none focus:border-black resize-none"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={updateProject}
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
                      <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
                      <button
                        onClick={() => setEditing(true)}
                        className="text-xs uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                    {project.category && (
                      <p className="text-sm uppercase tracking-wider text-neutral-500 mb-4">{project.category}</p>
                    )}
                    {project.description && (
                      <p className="text-neutral-600 mb-6">{project.description}</p>
                    )}
                    <div className="text-sm text-neutral-400 pt-4 border-t border-black/10">
                      <p>{images.length} images</p>
                      <p>{new Date(project.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}

                {/* Upload More */}
                <div className="mt-8 pt-8 border-t border-black/10">
                  <h3 className="text-sm uppercase tracking-wider text-neutral-500 mb-4">Add Images</h3>
                  <UploadForm projectId={id} />
                </div>
              </div>
            </div>

            {/* Images Grid */}
            <div className="lg:col-span-2">
              <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-6">
                Images ({images.length})
              </h2>
              {images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-black/10">
                  {images.map((image) => (
                    <div key={image.id} className="relative group bg-white">
                      <div className="aspect-square">
                        <img
                          src={image.url}
                          alt={image.filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        onClick={() => deleteImage(image.id)}
                        className="absolute top-2 right-2 p-2 bg-white/90 text-black opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black hover:text-white"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-black/10 p-12 text-center">
                  <p className="text-neutral-500">No images yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
