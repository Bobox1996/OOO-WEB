'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import TeamOField, { TeamOFieldRef } from '@/components/TeamOField'
import SiteHeader from '@/components/SiteHeader'
import { useGravityTitle } from '@/hooks/useGravityTitle'
import type { TeamMember, TeamDescription } from '@/lib/types'

interface TeamPageClientProps {
  oCount: number
  members: TeamMember[]
  teamDescription: TeamDescription | null
}

export default function TeamPageClient({ oCount, members, teamDescription }: TeamPageClientProps) {
  const [maxOffset, setMaxOffset] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const titleTextRef = useRef<HTMLHeadingElement>(null)
  const oFieldRef = useRef<TeamOFieldRef>(null)

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

  // Handle Team link click - reset selection to show all members
  const handleTeamClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    oFieldRef.current?.resetSelection()
  }, [])

  return (
    <>
      <SiteHeader onTeamClick={handleTeamClick} />

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
            Team
          </h1>
        </div>
      </div>

      {/* O-Field with embedded names - fills viewport below header */}
      <section className="fixed top-[60px] left-0 right-0 bottom-0 z-[45] px-6">
        <div className="max-w-screen-2xl mx-auto h-full">
          <TeamOField 
            ref={oFieldRef}
            oCount={oCount}
            members={members}
            teamDescription={teamDescription}
            onScroll={handleScroll}
          />
        </div>
      </section>
    </>
  )
}
