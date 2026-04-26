'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/services/supabase/client'
import AdminNav from '@/components/layout/AdminNav'
import UploadForm from '@/components/admin/UploadForm'
import SortableImage from '@/components/ui/SortableImage'
import { useRouter } from 'next/navigation'
import type { Project, Image } from '@/types'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [images, setImages] = useState<Image[]>([])
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({ index: '', title: '', description: '', category: '', team: '' })
  const [saving, setSaving] = useState(false)
  const [settingCover, setSettingCover] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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
        team: projectData.team || '',
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
        team: formData.team || null,
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = images.findIndex((img) => img.id === active.id)
    const newIndex = images.findIndex((img) => img.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Optimistically update local state
    const reorderedImages = arrayMove(images, oldIndex, newIndex)
    setImages(reorderedImages)

    // Update sort_order for all affected images in the database
    const updates = reorderedImages.map((img, index) => ({
      id: img.id,
      sort_order: index,
    }))

    // Update each image's sort_order in the database
    for (const update of updates) {
      await supabase
        .from('images')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id)
    }
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

  const toggleSideBySide = async (imageId: string) => {
    const image = images.find(img => img.id === imageId)
    if (!image) return

    const newValue = !image.side_by_side
    const { error } = await supabase
      .from('images')
      .update({ side_by_side: newValue })
      .eq('id', imageId)

    if (!error) {
      setImages(images.map(img => 
        img.id === imageId ? { ...img, side_by_side: newValue } : img
      ))
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
                    <div>
                      <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">COLLABORATOR</label>
                      <input
                        type="text"
                        value={formData.team}
                        onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                        placeholder="e.g., John Doe, Jane Smith"
                        className="w-full px-3 py-3 bg-neutral-50 border border-black/20 text-black placeholder-neutral-400 focus:outline-none focus:border-black focus:bg-white"
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
                  Drag to reorder
                </p>
              </div>
              {images.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={images.map((img) => img.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {images.map((image, index) => (
                        <SortableImage
                          key={image.id}
                          image={image}
                          index={index}
                          project={project}
                          onSetCover={setCoverImage}
                          onDelete={deleteImage}
                          onToggleSideBySide={toggleSideBySide}
                          settingCover={settingCover}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
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
