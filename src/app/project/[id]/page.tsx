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
      .order('sort_order', { ascending: true })

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

  // Separate first image (hero) from remaining images
  const heroImage = images.length > 0 ? images[0] : null
  const remainingImages = images.slice(1)

  return (
    <div className="min-h-screen bg-white">
      {/* Floating Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="flex items-center justify-between px-6 py-5">
          <Link 
            href="/" 
            className="text-2xl font-bold tracking-tight text-black pointer-events-auto hover:opacity-70 transition-opacity"
          >
            OOO
          </Link>
          <Link 
            href="/" 
            className="text-sm uppercase tracking-widest text-black pointer-events-auto hover:opacity-70 transition-opacity"
          >
            ← Back
          </Link>
        </div>
      </nav>

      {/* Hero Section with First Image */}
      {heroImage ? (
        <section 
          className="relative w-full h-screen cursor-pointer"
          onClick={() => openLightbox(0)}
        >
          <img
            src={heroImage.url}
            alt={heroImage.filename}
            className="w-full h-full object-cover"
          />
          {/* Title Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
            <div className="max-w-screen-2xl mx-auto">
              <h1 className="text-[clamp(2.5rem,8vw,6rem)] font-bold leading-[0.9] tracking-tighter uppercase text-white mb-3">
                {project.title}
              </h1>
              {project.category && (
                <p className="text-sm md:text-base uppercase tracking-widest text-white/80">
                  {project.category}
                </p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="w-full h-[50vh] bg-neutral-100 flex items-end">
          <div className="p-8 md:p-12 w-full">
            <h1 className="text-[clamp(2.5rem,8vw,6rem)] font-bold leading-[0.9] tracking-tighter uppercase">
              {project.title}
            </h1>
            {project.category && (
              <p className="text-sm md:text-base uppercase tracking-widest text-neutral-500 mt-3">
                {project.category}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Description Section - Landscape Format */}
      {project.description && (
        <section className="border-b border-black/10">
          <div className="max-w-screen-2xl mx-auto px-6 md:px-12 py-16 md:py-24">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16">
              {/* Left Column - Meta */}
              <div className="md:col-span-3">
                <div className="space-y-6">
                  {project.category && (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-neutral-400 mb-1">Category</p>
                      <p className="text-sm uppercase tracking-wider">{project.category}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase tracking-widest text-neutral-400 mb-1">Date</p>
                    <p className="text-sm">
                      {new Date(project.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-neutral-400 mb-1">Images</p>
                    <p className="text-sm">{images.length}</p>
                  </div>
                </div>
              </div>
              {/* Right Column - Description */}
              <div className="md:col-span-9">
                <p className="text-sm uppercase tracking-wider whitespace-pre-wrap">
                  {project.description}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Remaining Images - Contained */}
      {remainingImages.length > 0 && (
        <section className="py-12 md:py-16">
          <div className="max-w-screen-2xl mx-auto px-6 md:px-12 space-y-8 md:space-y-12">
            {remainingImages.map((image, index) => (
              <div
                key={image.id}
                onClick={() => openLightbox(index + 1)}
                className="w-full cursor-pointer"
              >
                <img
                  src={image.url}
                  alt={image.filename}
                  className="w-full h-auto block"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* No Images State */}
      {images.length === 0 && (
        <section className="py-32 text-center border-b border-black/10">
          <p className="text-neutral-500 uppercase tracking-wider text-sm">No images</p>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-black/10 px-6 py-8">
        <div className="max-w-screen-2xl mx-auto flex flex-col items-center gap-4 md:flex-row md:justify-between md:gap-0">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} OOO
          </p>
          <div className="flex flex-col items-center gap-2 md:flex-row md:gap-8">
            <a 
              href="mailto:office@out-of-office.design" 
              className="text-sm text-neutral-500 hover:opacity-50 transition-opacity"
            >
              office@out-of-office.design
            </a>
            <Link href="/" className="text-sm uppercase tracking-wider hover:opacity-50 transition-opacity">
              All Works
            </Link>
          </div>
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
