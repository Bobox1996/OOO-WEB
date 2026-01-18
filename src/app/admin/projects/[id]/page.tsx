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
  const [formData, setFormData] = useState({ index: '', title: '', description: '', category: '' })
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState<string | null>(null)
  const [settingCover, setSettingCover] = useState(false)
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
        index: projectData.index || '',
        title: projectData.title,
        description: projectData.description || '',
        category: projectData.category || '',
      })
    }

    const { data: imagesData } = await supabase
      .from('images')
      .select('*')
      .eq('project_id', id)
      .order('sort_order', { ascending: true })

    if (imagesData) setImages(imagesData)
  }

  const updateProject = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('projects')
      .update({
        index: formData.index || null,
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

  const moveImage = async (imageId: string, direction: 'up' | 'down') => {
    const currentIndex = images.findIndex(img => img.id === imageId)
    if (currentIndex === -1) return
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= images.length) return

    setReordering(imageId)

    // Swap the two images
    const currentImage = images[currentIndex]
    const swapImage = images[newIndex]

    // Update both images in the database
    const { error: error1 } = await supabase
      .from('images')
      .update({ sort_order: swapImage.sort_order })
      .eq('id', currentImage.id)

    const { error: error2 } = await supabase
      .from('images')
      .update({ sort_order: currentImage.sort_order })
      .eq('id', swapImage.id)

    if (!error1 && !error2) {
      // Update local state
      const newImages = [...images]
      const tempOrder = newImages[currentIndex].sort_order
      newImages[currentIndex] = { ...swapImage, sort_order: tempOrder }
      newImages[newIndex] = { ...currentImage, sort_order: swapImage.sort_order }
      // Re-sort by sort_order
      newImages.sort((a, b) => a.sort_order - b.sort_order)
      setImages(newImages)
    }

    setReordering(null)
  }

  const setCoverImage = async (imageId: string) => {
    setSettingCover(true)
    const { error } = await supabase
      .from('projects')
      .update({ cover_image_id: imageId })
      .eq('id', id)

    if (!error) {
      setProject({ ...project!, cover_image_id: imageId })
    }
    setSettingCover(false)
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
                      <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">Index</label>
                      <input
                        type="text"
                        value={formData.index}
                        onChange={(e) => setFormData({ ...formData, index: e.target.value })}
                        placeholder="Display index (e.g., 01, A1)"
                        className="w-full px-3 py-3 bg-neutral-50 border border-black/20 text-black placeholder-neutral-400 focus:outline-none focus:border-black focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Project title"
                        className="w-full px-3 py-3 bg-neutral-50 border border-black/20 text-black placeholder-neutral-400 focus:outline-none focus:border-black focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">Category</label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="e.g., Architecture, Photography"
                        className="w-full px-3 py-3 bg-neutral-50 border border-black/20 text-black placeholder-neutral-400 focus:outline-none focus:border-black focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={4}
                        placeholder="Brief description..."
                        className="w-full px-3 py-3 bg-neutral-50 border border-black/20 text-black placeholder-neutral-400 focus:outline-none focus:border-black focus:bg-white resize-none"
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
                    {project.description ? (
                      <p className="text-neutral-600 mb-6 whitespace-pre-wrap">{project.description}</p>
                    ) : (
                      <p className="text-neutral-400 italic mb-6">No description yet</p>
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
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm uppercase tracking-wider text-neutral-500">
                  Images ({images.length})
                </h2>
                <p className="text-xs text-neutral-400">
                  Use arrows to reorder
                </p>
              </div>
              {images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((image, index) => (
                    <div key={image.id} className="relative group bg-white border border-black/10">
                      <div className="aspect-square">
                        <img
                          src={image.url}
                          alt={image.filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {/* Image number badge */}
                      <div className="absolute top-2 left-2 w-6 h-6 bg-black text-white text-xs flex items-center justify-center">
                        {index + 1}
                      </div>

                      {/* Cover badge */}
                      {project.cover_image_id === image.id && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-xs uppercase tracking-wider">
                          Cover
                        </div>
                      )}

                      {/* Controls overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                        {/* Top row: Set as Cover */}
                        {project.cover_image_id !== image.id && (
                          <button
                            onClick={() => setCoverImage(image.id)}
                            disabled={settingCover}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs uppercase tracking-wider hover:bg-blue-700 transition-colors disabled:opacity-50"
                            title="Set as cover image"
                          >
                            Set as Cover
                          </button>
                        )}
                        
                        {/* Bottom row: Move and Delete */}
                        <div className="flex items-center gap-2">
                          {/* Move Up */}
                          <button
                            onClick={() => moveImage(image.id, 'up')}
                            disabled={index === 0 || reordering === image.id}
                            className="p-2 bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>

                          {/* Move Down */}
                          <button
                            onClick={() => moveImage(image.id, 'down')}
                            disabled={index === images.length - 1 || reordering === image.id}
                            className="p-2 bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => deleteImage(image.id)}
                            className="p-2 bg-white text-black hover:bg-red-500 hover:text-white transition-colors"
                            title="Delete image"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
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
