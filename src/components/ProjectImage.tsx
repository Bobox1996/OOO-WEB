'use client'

import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { getContrastColorForImage } from '@/lib/utils/color.utils'

interface ProjectImageProps {
  src: string
  alt: string
  priority?: boolean
  onColorExtracted?: (color: string) => void
}

export default function ProjectImage({ src, alt, priority = false, onColorExtracted }: ProjectImageProps) {
  const [loaded, setLoaded] = useState(false)
  const colorExtracted = useRef(false)
  
  const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true)
    
    // Extract color only once per image
    if (onColorExtracted && !colorExtracted.current) {
      colorExtracted.current = true
      const img = e.currentTarget
      // Use requestIdleCallback for non-blocking color extraction
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          const color = getContrastColorForImage(img)
          onColorExtracted(color)
        })
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          const color = getContrastColorForImage(img)
          onColorExtracted(color)
        }, 0)
      }
    }
  }, [onColorExtracted])
  
  return (
    <>
      {/* Skeleton while loading */}
      {!loaded && <div className="absolute inset-0 bg-neutral-100 animate-pulse" />}
      <Image
        src={src}
        alt={alt}
        fill
        quality={90}
        className={`object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={handleLoad}
        sizes="(max-width: 768px) 100vw, 50vw"
        priority={priority}
        crossOrigin="anonymous"
      />
    </>
  )
}
