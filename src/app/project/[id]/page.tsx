'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Lightbox from '@/components/Lightbox'
import type { Project, Image } from '@/lib/types'

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [images, setImages] = useState<Image[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
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
    }

    const { data: imagesData } = await supabase
      .from('images')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false })

    if (imagesData) setImages(imagesData)
    setLoading(false)
  }

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index)
    setLightboxOpen(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border border-black border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Project not found</h1>
          <Link href="/" className="text-sm uppercase tracking-wider hover:opacity-50 transition-opacity">
            ← Back
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black/10">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            OOO
          </Link>
          <Link href="/" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
            ← Back
          </Link>
        </div>
      </header>

      {/* Project Header */}
      <section className="pt-32 pb-12 px-6 border-b border-black/10">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[0.95] tracking-tighter uppercase">
                {project.title}
              </h1>
            </div>
            <div className="flex flex-col justify-end">
              {project.category && (
                <p className="text-sm uppercase tracking-wider text-neutral-500 mb-2">
                  {project.category}
                </p>
              )}
              {project.description && (
                <p className="text-lg leading-relaxed text-neutral-600">
                  {project.description}
                </p>
              )}
              <p className="text-sm text-neutral-400 mt-6">
                {new Date(project.created_at).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long'
                })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Images Grid */}
      <section className="px-6 py-12">
        <div className="max-w-screen-2xl mx-auto">
          {images.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-black/10">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  onClick={() => openLightbox(index)}
                  className="bg-white cursor-pointer img-zoom"
                >
                  <div className="aspect-[4/3]">
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center border border-black/10">
              <p className="text-neutral-500 uppercase tracking-wider text-sm">No images</p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/10 px-6 py-8">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} OOO
          </p>
          <Link href="/" className="text-sm uppercase tracking-wider hover:opacity-50 transition-opacity">
            All Projects
          </Link>
        </div>
      </footer>

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox
          images={images}
          currentIndex={currentImageIndex}
          onClose={() => setLightboxOpen(false)}
          onPrev={() => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)}
          onNext={() => setCurrentImageIndex((prev) => (prev + 1) % images.length)}
        />
      )}
    </div>
  )
}
