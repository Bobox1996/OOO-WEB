'use client'

import { useState } from 'react'
import type { Image } from '@/lib/types'

interface ImageCardProps {
  image: Image
  onClick?: () => void
}

export default function ImageCard({ image, onClick }: ImageCardProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      onClick={onClick}
      className="relative aspect-square bg-neutral-100 cursor-pointer img-zoom"
    >
      {/* Loading skeleton */}
      {!loaded && (
        <div className="absolute inset-0 bg-neutral-100 animate-pulse" />
      )}
      
      <img
        src={image.url}
        alt={image.filename}
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
