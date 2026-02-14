'use client'

import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useGravityTitle } from '@/hooks/useGravityTitle'
import SwimmingTitle from '@/components/SwimmingTitle'
import ProjectImage from '@/components/ProjectImage'

interface ProjectWithImages {
  id: string
  title: string
  index: string | null
  category: string | null
  cover_image_id: string | null
  images: { id: string; url: string }[]
}

interface HomePageClientProps {
  projects: ProjectWithImages[]
}

// Weighted random shuffle: projects with titles ending in " " have higher priority for third slot only
function shuffleWithPriority<T extends { title: string }>(projects: T[]): T[] {
  if (!projects || projects.length === 0) return projects
  
  const remaining = [...projects]
  const result: T[] = []
  
  // Slots 1 and 2: purely random selection
  for (let i = 0; i < 2 && remaining.length > 0; i++) {
    const idx = Math.floor(Math.random() * remaining.length)
    result.push(remaining.splice(idx, 1)[0])
  }
  
  // Slot 3: weighted selection (70% chance for priority projects)
  if (remaining.length > 0) {
    const priorityRemaining = remaining.filter(p => p.title.endsWith(' '))
    const usePriority = priorityRemaining.length > 0 && Math.random() < 0.7
    
    const pool = usePriority ? priorityRemaining : remaining
    const idx = Math.floor(Math.random() * pool.length)
    const selected = pool[idx]
    
    result.push(selected)
    remaining.splice(remaining.indexOf(selected), 1)
  }
  
  // Fisher-Yates shuffle for remaining projects
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[remaining[i], remaining[j]] = [remaining[j], remaining[i]]
  }
  
  return [...result, ...remaining]
}

export default function HomePageClient({ projects }: HomePageClientProps) {
  const [maxOffset, setMaxOffset] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const titleTextRef = useRef<HTMLHeadingElement>(null)
  const lastScrollY = useRef(0)

  // Shuffle projects on mount (client-side only for random order)
  const shuffledProjects = useMemo(() => shuffleWithPriority([...projects]), [projects])

  // Store text colors per project (based on cover image contrast)
  const [textColors, setTextColors] = useState<Record<string, string>>({})

  // Callback to update text color for a specific project
  const handleColorExtracted = useCallback((projectId: string, color: string) => {
    setTextColors(prev => {
      // Only update if color changed to avoid unnecessary re-renders
      if (prev[projectId] === color) return prev
      return { ...prev, [projectId]: color }
    })
  }, [])

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

      {/* Projects Grid */}
      <section className="relative z-30 bg-white px-0 md:px-6 pb-24">
        <div className="max-w-screen-2xl mx-auto">
          {shuffledProjects && shuffledProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-black/10">
              {shuffledProjects.map((project, index) => (
                <Link
                  key={project.id}
                  href={`/project/${project.id}`}
                  className="group bg-white"
                >
                  {/* Image */}
                  <div className="aspect-[4/3] bg-neutral-100 img-zoom relative">
                    {(() => {
                      // Find cover image or fall back to first image
                      const coverImage = project.cover_image_id 
                        ? project.images?.find((img: { id: string }) => img.id === project.cover_image_id)
                        : null
                      const displayImage = coverImage || project.images?.[0]
                      
                      if (displayImage) {
                        return (
                          <ProjectImage
                            src={displayImage.url}
                            alt={project.title}
                            priority={index < 2}
                            onColorExtracted={(color) => handleColorExtracted(project.id, color)}
                          />
                        )
                      }
                      return (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300">
                          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )
                    })()}
                    {/* Title Overlay */}
                    <SwimmingTitle title={project.title} textColor={textColors[project.id]} />
                  </div>
                  
                  {/* Info */}
                  <div className="p-6 border-t border-black/10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold tracking-tight group-hover:opacity-50 transition-opacity">
                          {project.index || project.title}
                        </h2>
                        {project.category && (
                          <p className="text-sm text-neutral-500 mt-1 uppercase tracking-wider">
                            {project.category}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-neutral-400 tabular-nums">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center border border-black/10">
              <p className="text-neutral-500 uppercase tracking-wider text-sm">No projects yet</p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
