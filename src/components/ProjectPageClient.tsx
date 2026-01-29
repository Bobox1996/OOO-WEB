'use client'

import { useState } from 'react'
import Image from 'next/image'
import Lightbox from '@/components/Lightbox'
import type { Image as ImageType, Project } from '@/lib/types'

interface ImageGroup {
  type: 'single' | 'pair'
  image?: ImageType
  images?: [ImageType, ImageType]
  originalIndex?: number
  originalIndices?: [number, number]
}

interface ProjectPageClientProps {
  project: Project
  images: ImageType[]
  imageGroups: ImageGroup[]
}

export default function ProjectPageClient({ project, images, imageGroups }: ProjectPageClientProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index)
    setLightboxOpen(true)
  }

  const heroImage = images.length > 0 ? images[0] : null

  return (
    <>
      {/* Hero Section with First Image */}
      {heroImage ? (
        <section 
          className="relative w-full h-[40vh] md:h-screen cursor-pointer"
          onClick={() => openLightbox(0)}
        >
          <Image
            src={heroImage.url}
            alt={heroImage.filename}
            fill
            priority
            quality={90}
            className="object-cover"
            sizes="100vw"
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

      {/* Remaining Images - Contained */}
      {imageGroups.length > 0 && (
        <section className="py-12 md:py-16">
          <div className="max-w-screen-2xl mx-auto px-9 md:px-72 space-y-8 md:space-y-12">
            {imageGroups.map((group) => {
              if (group.type === 'single' && group.image) {
                return (
                  <div
                    key={group.image.id}
                    onClick={() => openLightbox(group.originalIndex!)}
                    className="w-full cursor-pointer"
                  >
                    <Image
                      src={group.image.url}
                      alt={group.image.filename}
                      width={1920}
                      height={1280}
                      quality={90}
                      className="w-full h-auto block"
                      sizes="(max-width: 768px) 100vw, 800px"
                    />
                  </div>
                )
              }               else if (group.type === 'pair' && group.images) {
                // Paired side-by-side images
                return (
                  <div
                    key={`pair-${group.images[0].id}-${group.images[1].id}`}
                    className="w-full flex flex-row gap-2 md:gap-4"
                  >
                    <div
                      onClick={() => openLightbox(group.originalIndices![0])}
                      className="flex-1 cursor-pointer min-w-0"
                    >
                      <Image
                        src={group.images[0].url}
                        alt={group.images[0].filename}
                        width={960}
                        height={640}
                        quality={90}
                        className="w-full h-full object-cover block"
                        sizes="50vw"
                      />
                    </div>
                    <div
                      onClick={() => openLightbox(group.originalIndices![1])}
                      className="flex-1 cursor-pointer min-w-0"
                    >
                      <Image
                        src={group.images[1].url}
                        alt={group.images[1].filename}
                        width={960}
                        height={640}
                        quality={90}
                        className="w-full h-full object-cover block"
                        sizes="50vw"
                      />
                    </div>
                  </div>
                )
              }
              return null
            })}
          </div>
        </section>
      )}

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
    </>
  )
}
