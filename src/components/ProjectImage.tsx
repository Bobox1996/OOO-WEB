'use client'

import { useState } from 'react'
import Image from 'next/image'

interface ProjectImageProps {
  src: string
  alt: string
  priority?: boolean
}

export default function ProjectImage({ src, alt, priority = false }: ProjectImageProps) {
  const [loaded, setLoaded] = useState(false)
  
  return (
    <>
      {/* Skeleton while loading */}
      {!loaded && <div className="absolute inset-0 bg-neutral-100 animate-pulse" />}
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        sizes="(max-width: 768px) 100vw, 50vw"
        priority={priority}
      />
    </>
  )
}
