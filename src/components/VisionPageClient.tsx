'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import VisionOField, { VisionOFieldRef } from '@/components/VisionOField'
import { useGravityTitle } from '@/hooks/useGravityTitle'

interface VisionPageClientProps {
  oCount: number
  visionContent: string
}

export default function VisionPageClient({ oCount, visionContent }: VisionPageClientProps) {
  const [maxOffset, setMaxOffset] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const titleTextRef = useRef<HTMLHeadingElement>(null)
  const oFieldRef = useRef<VisionOFieldRef>(null)

  // Calculate max offset to show only half of the last text row
  useEffect(() => {
    const calculateMaxOffset = () => {
      if (containerRef.current && titleTextRef.current) {
        const containerHeight = containerRef.current.offsetHeight
        const textHeight = titleTextRef.current.offsetHeight
        
        // For single line: textHeight = one line
        // We want half of the last line to remain visible
        // maxOffset = containerHeight - (half of one text line height)
        const halfLineHeight = textHeight * 0.5
        setMaxOffset(containerHeight - halfLineHeight)
      }
    }

    calculateMaxOffset()
    window.addEventListener('resize', calculateMaxOffset)
    return () => window.removeEventListener('resize', calculateMaxOffset)
  }, [])

  // Use gravity hook for smooth pull-back effect (slow like water)
  const { titleOffset, handleScroll } = useGravityTitle({
    maxOffset,
    gravitySpeed: 0.5,  // pixels per frame - slow like gravity in water
    scrollStopDelay: 100,  // ms before gravity kicks in
  })

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black/10">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            OOO
          </Link>
          <nav className="flex items-center gap-8">
            <Link href="/" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
              Works
            </Link>
            <Link href="/team" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
              Team
            </Link>
            <Link href="/vision" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
              Vision
            </Link>
          </nav>
        </div>
      </header>

      {/* Floating title - moves up with scroll, gravity pulls it back */}
      <div 
        ref={containerRef}
        className="fixed left-0 right-0 z-40 pt-8 px-6 pointer-events-none"
        style={{ 
          top: 60,
          transform: `translateY(-${titleOffset}px) translateZ(0)`,
          willChange: 'transform',
        }}
      >
        <div className="max-w-screen-2xl mx-auto">
          <h1 
            ref={titleTextRef}
            className="text-[clamp(3rem,10vw,8rem)] font-bold leading-[0.9] tracking-tighter uppercase"
          >
            Vision
          </h1>
        </div>
      </div>

      {/* O-Field with embedded vision text - fills viewport below header */}
      <section className="fixed top-[60px] left-0 right-0 bottom-0 z-[45] px-6">
        <div className="max-w-screen-2xl mx-auto h-full">
          <VisionOField 
            ref={oFieldRef}
            oCount={oCount}
            visionContent={visionContent}
            onScroll={handleScroll}
          />
        </div>
      </section>
    </>
  )
}
