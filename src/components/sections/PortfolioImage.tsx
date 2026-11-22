'use client'

import Image, { type ImageProps } from 'next/image'
import { useState } from 'react'

/** Retry the original Supabase file if a resized rendition is unavailable. */
export default function PortfolioImage(props: ImageProps) {
  const [original, setOriginal] = useState<ImageProps['src'] | null>(null)
  return <Image {...props} alt={props.alt} unoptimized={original === props.src}
    onError={() => setOriginal(props.src)} />
}
