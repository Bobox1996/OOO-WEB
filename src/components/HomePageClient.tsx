'use client'

import { useRef, useEffect, useState } from 'react'
import { useGravityTitle } from '@/hooks/useGravityTitle'

interface HomePageClientProps {
  children: React.ReactNode
}

export default function HomePageClient({ children }: HomePageClientProps) {
  const [maxOffset, setMaxOffset] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const titleTextRef = useRef<HTMLHeadingElement>(null)
  const lastScrollY = useRef(0)

  // Calculate max offset to show only half of the last text row (2 lines)
  useEffect(() => {
    const calculateMaxOffset = () => {
      if (containerRef.current && titleTextRef.current) {
        const containerHeight = containerRef.current.offsetHeight
        const textHeight = titleTextRef.current.offsetHeight
        
        // For 2 lines, we want half of ONE line to remain visible
        // Approximate one line height = textHeight / 2
        const oneLineHeight = textHeight / 2
        const halfLineHeight = oneLineHeight * 0.5
        setMaxOffset(containerHeight - halfLineHeight)
      }
    }

    calculateMaxOffset()
    window.addEventListener('resize', calculateMaxOffset)
    return () => window.removeEventListener('resize', calculateMaxOffset)
  }, [])

  // Use gravity hook (slow like gravity in water)
  const { titleOffset, handleScroll } = useGravityTitle({
    maxOffset,
    gravitySpeed: 0.5,  // pixels per frame - slow like gravity in water
    scrollStopDelay: 100,
  })

  // Listen to page scroll
  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY
      handleScroll(scrollY)
      lastScrollY.current = scrollY
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [handleScroll])

  return (
    <>
      {/* Spacer for fixed header */}
      <div className="h-[60px]" />

      {/* Floating title with gravity effect */}
      <div 
        ref={containerRef}
        className="fixed left-0 right-0 z-40 pt-12 pb-4 px-6 pointer-events-none"
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
            Selected
            <br />
            Works
          </h1>
        </div>
      </div>

      {/* Spacer to account for the title area */}
      <div style={{ height: 'calc(clamp(3rem,10vw,8rem) * 0.9 * 2 + 6rem)' }} />

      {/* Rest of page content */}
      {children}
    </>
  )
}
