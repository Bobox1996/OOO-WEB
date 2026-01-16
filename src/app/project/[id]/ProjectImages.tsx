'use client'

import { useState } from 'react'
import Lightbox from '@/components/Lightbox'
import type { Image } from '@/lib/types'

interface ProjectImagesProps {
  images: Image[]
}

export default function ProjectImages({ images }: ProjectImagesProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index)
    setLightboxOpen(true)
  }

  return (
    <>
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
