'use client'

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react'
import Image from 'next/image'
import type { TeamMember } from '@/lib/types'

interface LineSegment {
  type: 'o' | 'name' | 'description'
  content: string
  memberId?: string
}

interface TeamOFieldProps {
  oCount: number
  members: TeamMember[]
  onScroll?: (scrollTop: number) => void
}

export interface TeamOFieldRef {
  scrollContainer: HTMLDivElement | null
}

// Buffer lines to render above/below viewport for smooth scrolling
const RENDER_BUFFER = 5

// Throttle helper - limits function calls to once per delay ms
function throttle<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let lastCall = 0
  let timeoutId: NodeJS.Timeout | null = null
  
  return ((...args: Parameters<T>) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCall
    
    if (timeSinceLastCall >= delay) {
      lastCall = now
      fn(...args)
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now()
        timeoutId = null
        fn(...args)
      }, delay - timeSinceLastCall)
    }
  }) as T
}

const TeamOField = forwardRef<TeamOFieldRef, TeamOFieldProps>(({ oCount, members, onScroll }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textContainerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const nameMeasureRef = useRef<HTMLSpanElement>(null)
  const contentHeightRef = useRef(0)
  const randomSeed = useRef(Math.random() * 10000)
  const [charsPerLine, setCharsPerLine] = useState(50)
  const [visibleLines, setVisibleLines] = useState(0)
  const [lineHeight, setLineHeight] = useState(0)
  const [oCharWidth, setOCharWidth] = useState(0)
  const [memberMeasurements, setMemberMeasurements] = useState<Map<string, { name: string; osToReplace: number }>>(new Map())
  const [descriptionLines, setDescriptionLines] = useState<{ text: string; osToReplace: number }[]>([])
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const cursorOverlayRef = useRef<HTMLDivElement>(null)
  
  // Virtualization state - track current scroll position for visible range calculation
  const [scrollTop, setScrollTop] = useState(0)

  // Create a map for quick member lookup by ID (memoized)
  const memberMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members])

  // Expose scroll container ref to parent
  useImperativeHandle(ref, () => ({
    scrollContainer: scrollContainerRef.current
  }))

  // Calculate how many O's fit per line, visible lines, and line height
  useEffect(() => {
    const calculate = () => {
      if (textContainerRef.current && measureRef.current && scrollContainerRef.current) {
        const containerWidth = textContainerRef.current.offsetWidth
        const charWidth = measureRef.current.offsetWidth
        const charHeight = measureRef.current.offsetHeight
        const viewportHeight = scrollContainerRef.current.offsetHeight
        
        if (charWidth > 0 && charHeight > 0) {
          const chars = Math.floor(containerWidth / charWidth)
          setCharsPerLine(chars > 0 ? chars : 50)
          setOCharWidth(charWidth)
          
          const computedLineHeight = charHeight
          setLineHeight(computedLineHeight)
          
          const visible = Math.floor(viewportHeight / computedLineHeight)
          setVisibleLines(visible > 0 ? visible : 10)
        }
      }
    }
    
    const timer = setTimeout(calculate, 50)
    
    window.addEventListener('resize', calculate)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', calculate)
    }
  }, [])

  // Calculate total lines for virtualization
  const totalLines = useMemo(() => Math.ceil(oCount / charsPerLine), [oCount, charsPerLine])

  // Measure content height after mount
  useEffect(() => {
    const measureHeight = () => {
      if (lineHeight > 0 && totalLines > 0) {
        // Content height is lines * lineHeight (will be doubled for infinite scroll)
        contentHeightRef.current = totalLines * lineHeight
      }
    }
    
    measureHeight()
    window.addEventListener('resize', measureHeight)
    
    return () => {
      window.removeEventListener('resize', measureHeight)
    }
  }, [lineHeight, totalLines])

  // Measure each member's name width and calculate Os to replace
  useEffect(() => {
    if (!nameMeasureRef.current || !measureRef.current || oCharWidth === 0 || members.length === 0) return

    const measurements = new Map<string, { name: string; osToReplace: number }>()
    
    members.forEach(member => {
      const nameText = `${member.first_name} ${member.last_name}`
      
      nameMeasureRef.current!.textContent = nameText
      const nameWidth = nameMeasureRef.current!.offsetWidth
      
      let osToReplace = Math.ceil(nameWidth / oCharWidth)
      
      measureRef.current!.textContent = 'O'.repeat(osToReplace)
      let osWidth = measureRef.current!.offsetWidth
      
      while (osWidth < nameWidth && osToReplace < 100) {
        osToReplace++
        measureRef.current!.textContent = 'O'.repeat(osToReplace)
        osWidth = measureRef.current!.offsetWidth
      }
      
      measurements.set(member.id, { name: nameText, osToReplace })
      
      measureRef.current!.textContent = 'O'
    })
    
    nameMeasureRef.current.textContent = ''
    
    setMemberMeasurements(measurements)
  }, [members, oCharWidth])

  // Measure description lines when a member is selected
  useEffect(() => {
    if (!selectedMember?.description || !nameMeasureRef.current || !measureRef.current || oCharWidth === 0 || charsPerLine === 0) {
      setDescriptionLines([])
      return
    }

    measureRef.current.textContent = 'O'.repeat(charsPerLine)
    const fullLineOsWidth = measureRef.current.offsetWidth

    const rawLines = selectedMember.description.split('\n')
    const processedLines: { text: string; osToReplace: number }[] = []

    rawLines.forEach(rawLine => {
      if (!rawLine.trim()) {
        processedLines.push({ text: '', osToReplace: 0 })
        return
      }

      nameMeasureRef.current!.textContent = rawLine
      const lineWidth = nameMeasureRef.current!.offsetWidth

      if (lineWidth <= fullLineOsWidth) {
        let osToReplace = Math.ceil(lineWidth / oCharWidth)
        
        measureRef.current!.textContent = 'O'.repeat(osToReplace)
        let osWidth = measureRef.current!.offsetWidth
        
        while (osWidth < lineWidth && osToReplace < charsPerLine) {
          osToReplace++
          measureRef.current!.textContent = 'O'.repeat(osToReplace)
          osWidth = measureRef.current!.offsetWidth
        }

        processedLines.push({ text: rawLine, osToReplace })
      } else {
        const words = rawLine.split(' ')
        let currentLine = ''
        
        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word
          nameMeasureRef.current!.textContent = testLine
          const testWidth = nameMeasureRef.current!.offsetWidth

          if (testWidth <= fullLineOsWidth) {
            currentLine = testLine
          } else {
            if (currentLine) {
              nameMeasureRef.current!.textContent = currentLine
              const currentWidth = nameMeasureRef.current!.offsetWidth
              let osToReplace = Math.ceil(currentWidth / oCharWidth)
              
              measureRef.current!.textContent = 'O'.repeat(osToReplace)
              let osWidth = measureRef.current!.offsetWidth
              while (osWidth < currentWidth && osToReplace < charsPerLine) {
                osToReplace++
                measureRef.current!.textContent = 'O'.repeat(osToReplace)
                osWidth = measureRef.current!.offsetWidth
              }

              processedLines.push({ text: currentLine, osToReplace })
            }
            currentLine = word
          }
        })

        if (currentLine) {
          nameMeasureRef.current!.textContent = currentLine
          const currentWidth = nameMeasureRef.current!.offsetWidth
          let osToReplace = Math.ceil(currentWidth / oCharWidth)
          
          measureRef.current!.textContent = 'O'.repeat(osToReplace)
          let osWidth = measureRef.current!.offsetWidth
          while (osWidth < currentWidth && osToReplace < charsPerLine) {
            osToReplace++
            measureRef.current!.textContent = 'O'.repeat(osToReplace)
            osWidth = measureRef.current!.offsetWidth
          }

          processedLines.push({ text: currentLine, osToReplace })
        }
      }
    })

    measureRef.current.textContent = 'O'
    nameMeasureRef.current.textContent = ''

    setDescriptionLines(processedLines)
  }, [selectedMember, oCharWidth, charsPerLine])

  // Track mouse position relative to viewport for cursor mask
  const mouseClientPos = useRef<{ x: number; y: number } | null>(null)

  // Update cursor position via ref (avoids React re-renders)
  const updateCursorPos = useCallback(() => {
    if (scrollContainerRef.current && mouseClientPos.current && cursorOverlayRef.current) {
      const rect = scrollContainerRef.current.getBoundingClientRect()
      const x = mouseClientPos.current.x - rect.left
      const y = mouseClientPos.current.y - rect.top + scrollContainerRef.current.scrollTop
      cursorOverlayRef.current.style.transform = `translate3d(${x - 250}px, ${y - 250}px, 0)`
      cursorOverlayRef.current.style.display = 'block'
    }
  }, [])

  // Throttled scroll handler for virtualization state updates
  const throttledSetScrollTop = useMemo(
    () => throttle((value: number) => setScrollTop(value), 16),
    []
  )

  // Handle infinite scroll loop
  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current
    const contentHeight = contentHeightRef.current
    if (!scrollContainer || contentHeight === 0) return

    let currentScrollTop = scrollContainer.scrollTop

    // Call onScroll callback for parent to sync title position
    onScroll?.(currentScrollTop)

    // Update cursor overlay position while scrolling
    updateCursorPos()

    // When we've scrolled past the first content block, reset to beginning
    if (currentScrollTop >= contentHeight) {
      currentScrollTop = currentScrollTop - contentHeight
      scrollContainer.scrollTop = currentScrollTop
    }
    // Note: We don't handle scrolling up past start (scrollTop < 0) because browsers 
    // prevent scrollTop from going negative. The previous condition (scrollTop <= 0)
    // caused an infinite loop when reaching the top.
    
    // Update virtualization scroll position (throttled)
    throttledSetScrollTop(currentScrollTop)
  }, [onScroll, updateCursorPos, throttledSetScrollTop])

  // Seeded random for consistent rendering
  const seededRandom = useCallback((seed: number) => {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }, [])

  // Handle name click - select the member
  const handleNameClick = useCallback((e: React.MouseEvent, memberId: string) => {
    e.stopPropagation()
    const member = memberMap.get(memberId)
    if (member) {
      setSelectedMember(member)
    }
  }, [memberMap])

  // Handle background click - exit selection mode
  const handleBackgroundClick = useCallback(() => {
    if (selectedMember) {
      setSelectedMember(null)
    }
  }, [selectedMember])

  // Throttled mouse move handler for cursor mask effect
  const throttledUpdateCursor = useMemo(
    () => throttle((x: number, y: number) => {
      mouseClientPos.current = { x, y }
      updateCursorPos()
    }, 16),
    [updateCursorPos]
  )

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    throttledUpdateCursor(e.clientX, e.clientY)
  }, [throttledUpdateCursor])

  // Handle mouse leave - hide cursor mask
  const handleMouseLeave = useCallback(() => {
    mouseClientPos.current = null
    if (cursorOverlayRef.current) {
      cursorOverlayRef.current.style.display = 'none'
    }
  }, [])

  // Build lines with member names inserted at random positions (one name per line)
  const buildLinesWithNames = useCallback((): LineSegment[][] => {
    const lines: LineSegment[][] = []
    
    // Initialize all lines as pure O's
    for (let i = 0; i < totalLines; i++) {
      lines.push([{ type: 'o', content: 'O'.repeat(charsPerLine) }])
    }
    
    // If no members or measurements not ready, return pure O lines
    if (members.length === 0 || memberMeasurements.size === 0 || visibleLines === 0) {
      return lines
    }
    
    // Track which lines are already used to prevent multiple names per line
    const usedLines = new Set<number>()
    const maxAvailableLines = Math.min(visibleLines, totalLines)
    
    // Assign each member to a unique random line within visible lines
    members.forEach((member, memberIndex) => {
      const measurement = memberMeasurements.get(member.id)
      if (!measurement) return
      
      if (usedLines.size >= maxAvailableLines) return
      
      let seed = member.id.charCodeAt(0) + memberIndex + randomSeed.current
      let lineIndex: number
      let attempts = 0
      do {
        lineIndex = Math.floor(seededRandom(seed) * maxAvailableLines)
        seed++
        attempts++
      } while (usedLines.has(lineIndex) && attempts < 100)
      
      usedLines.add(lineIndex)
      
      const maxStartPos = Math.max(0, charsPerLine - measurement.osToReplace)
      const startPos = Math.floor(seededRandom(seed + 1) * maxStartPos)
      
      const newSegments: LineSegment[] = []
      
      if (startPos > 0) {
        newSegments.push({ type: 'o', content: 'O'.repeat(startPos) })
      }
      newSegments.push({ type: 'name', content: measurement.name, memberId: member.id })
      const endPos = startPos + measurement.osToReplace
      if (endPos < charsPerLine) {
        newSegments.push({ type: 'o', content: 'O'.repeat(charsPerLine - endPos) })
      }
      
      lines[lineIndex] = newSegments
    })
    
    return lines
  }, [totalLines, charsPerLine, members, memberMeasurements, visibleLines, seededRandom])

  // Build lines for selected state (only selected name at line 10, description at line 13+)
  const buildSelectedLines = useCallback((): LineSegment[][] => {
    const lines: LineSegment[][] = []
    
    // Initialize all lines as pure O's
    for (let i = 0; i < totalLines; i++) {
      lines.push([{ type: 'o', content: 'O'.repeat(charsPerLine) }])
    }
    
    if (!selectedMember) return lines
    
    const measurement = memberMeasurements.get(selectedMember.id)
    if (!measurement) return lines
    
    const nameTargetLine = 9
    if (nameTargetLine < totalLines) {
      const newSegments: LineSegment[] = []
      newSegments.push({ type: 'name', content: measurement.name, memberId: selectedMember.id })
      const remainingOs = charsPerLine - measurement.osToReplace
      if (remainingOs > 0) {
        newSegments.push({ type: 'o', content: 'O'.repeat(remainingOs) })
      }
      lines[nameTargetLine] = newSegments
    }
    
    const descriptionStartLine = 12
    descriptionLines.forEach((descLine, idx) => {
      const targetLine = descriptionStartLine + idx
      if (targetLine < totalLines) {
        const newSegments: LineSegment[] = []
        
        if (descLine.text) {
          newSegments.push({ type: 'description', content: descLine.text })
          const remainingOs = charsPerLine - descLine.osToReplace
          if (remainingOs > 0) {
            newSegments.push({ type: 'o', content: 'O'.repeat(remainingOs) })
          }
        } else {
          newSegments.push({ type: 'o', content: 'O'.repeat(charsPerLine) })
        }
        
        lines[targetLine] = newSegments
      }
    })
    
    return lines
  }, [totalLines, charsPerLine, selectedMember, memberMeasurements, descriptionLines])

  // Generate all lines based on selection state (memoized)
  const allLines = useMemo(
    () => selectedMember ? buildSelectedLines() : buildLinesWithNames(),
    [selectedMember, buildSelectedLines, buildLinesWithNames]
  )

  // Calculate which lines are visible based on scroll position (virtualization)
  const { visibleStart, visibleEnd, totalHeight } = useMemo(() => {
    if (lineHeight === 0) {
      return { visibleStart: 0, visibleEnd: Math.min(20, totalLines), totalHeight: 0 }
    }
    
    // Total height is doubled for infinite scroll
    const height = totalLines * lineHeight * 2
    
    // Calculate visible range with buffer
    const start = Math.max(0, Math.floor(scrollTop / lineHeight) - RENDER_BUFFER)
    const end = Math.min(totalLines * 2, Math.ceil((scrollTop + (visibleLines * lineHeight)) / lineHeight) + RENDER_BUFFER)
    
    return { visibleStart: start, visibleEnd: end, totalHeight: height }
  }, [scrollTop, lineHeight, totalLines, visibleLines])

  // Get visible lines for rendering (handles the duplicated content)
  const visibleLinesData = useMemo(() => {
    const result: { lineSegments: LineSegment[]; index: number; isSecondSet: boolean }[] = []
    
    for (let i = visibleStart; i < visibleEnd; i++) {
      const isSecondSet = i >= totalLines
      const actualIndex = isSecondSet ? i - totalLines : i
      
      if (actualIndex >= 0 && actualIndex < allLines.length) {
        result.push({
          lineSegments: allLines[actualIndex],
          index: i,
          isSecondSet
        })
      }
    }
    
    return result
  }, [visibleStart, visibleEnd, totalLines, allLines])

  // Render a single line with only O characters (for bottom layer affected by cursor overlay)
  const renderOsOnlyLine = useCallback((lineSegments: LineSegment[], index: number, isSecondSet: boolean) => {
    const key = isSecondSet ? `os-second-${index - totalLines}` : `os-first-${index}`
    
    return (
      <div 
        key={key}
        className="whitespace-nowrap absolute left-0 right-0" 
        style={{ 
          height: lineHeight || 'auto',
          top: index * lineHeight,
          willChange: 'transform'
        }}
      >
        {lineSegments.map((segment, j) => {
          if (segment.type === 'name') {
            // Render invisible placeholder to maintain spacing
            return <span key={j} className="invisible">{segment.content}</span>
          } else if (segment.type === 'description') {
            // Render invisible placeholder to maintain spacing
            return <span key={j} className="invisible">{segment.content}</span>
          } else {
            return <span key={j}>{segment.content}</span>
          }
        })}
      </div>
    )
  }, [lineHeight, totalLines])

  // Render a single line with only names and descriptions (for top layer unaffected by cursor overlay)
  const renderNamesOnlyLine = useCallback((lineSegments: LineSegment[], index: number, isSecondSet: boolean) => {
    const key = isSecondSet ? `names-second-${index - totalLines}` : `names-first-${index}`
    
    // Check if this line has any name or description segments
    const hasNameOrDescription = lineSegments.some(s => s.type === 'name' || s.type === 'description')
    if (!hasNameOrDescription) return null
    
    return (
      <div 
        key={key}
        className="whitespace-nowrap absolute left-0 right-0 pointer-events-auto" 
        style={{ 
          height: lineHeight || 'auto',
          top: index * lineHeight,
          willChange: 'transform'
        }}
      >
        {lineSegments.map((segment, j) => {
          if (segment.type === 'name') {
            // Use CSS animation class for vibration instead of JS
            const shouldVibrate = !selectedMember
            return (
              <span 
                key={j} 
                className={`text-green-500 cursor-pointer hover:opacity-70 transition-opacity inline-block ${shouldVibrate ? 'name-vibrate' : ''}`}
                onClick={(e) => handleNameClick(e, segment.memberId!)}
              >
                {segment.content}
              </span>
            )
          } else if (segment.type === 'description') {
            return (
              <span key={j} className="text-red-500">
                {segment.content}
              </span>
            )
          } else {
            // Render invisible O's to maintain spacing
            return <span key={j} className="invisible">{segment.content}</span>
          }
        })}
      </div>
    )
  }, [lineHeight, totalLines, selectedMember, handleNameClick])

  return (
    <div 
      ref={containerRef} 
      className="relative h-full w-full cursor-pointer"
      onClick={handleBackgroundClick}
    >
      {/* Hidden element to measure character width */}
      <span 
        ref={measureRef}
        className="absolute opacity-0 pointer-events-none font-bold text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1] tracking-tight"
        aria-hidden="true"
      >
        O
      </span>
      {/* Hidden element to measure name widths */}
      <span 
        ref={nameMeasureRef}
        className="absolute opacity-0 pointer-events-none font-bold text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1] tracking-tight whitespace-nowrap"
        aria-hidden="true"
      />

      {/* Infinite scroll container */}
      <div 
        ref={scrollContainerRef}
        className="infinite-scroll-container"
        onScroll={handleScroll}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Layer 1: O characters only (bottom layer - affected by cursor overlay) */}
        <div 
          ref={textContainerRef}
          className="w-full font-bold text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1] tracking-tight select-none text-black relative"
          style={{ height: totalHeight, zIndex: 1 }}
        >
          {visibleLinesData.map(({ lineSegments, index, isSecondSet }) => 
            renderOsOnlyLine(lineSegments, index, isSecondSet)
          )}
        </div>

        {/* Layer 2: Cursor mask overlay - white radial gradient that follows cursor */}
        <div
          ref={cursorOverlayRef}
          className="pointer-events-none absolute rounded-full top-0 left-0"
          style={{
            display: 'none',
            width: 500,
            height: 500,
            background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)',
            zIndex: 50,
            willChange: 'transform',
          }}
        />

        {/* Layer 3: Names and descriptions only (top layer - NOT affected by cursor overlay) */}
        <div 
          className="absolute top-0 left-0 w-full font-bold text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1] tracking-tight select-none pointer-events-none"
          style={{ height: totalHeight, zIndex: 100 }}
        >
          {visibleLinesData.map(({ lineSegments, index, isSecondSet }) => 
            renderNamesOnlyLine(lineSegments, index, isSecondSet)
          )}
        </div>
      </div>

      {/* Portrait overlay when member is selected */}
      {selectedMember && selectedMember.portrait_url && (
        <div 
          className="fixed inset-x-0 bottom-0 pointer-events-none z-[150]"
          style={{ height: '70vh' }}
        >
          <div className="relative w-full h-full">
            <Image
              src={selectedMember.portrait_url}
              alt={`${selectedMember.first_name} ${selectedMember.last_name}`}
              fill
              className="object-contain object-bottom"
              sizes="100vw"
              priority
            />
          </div>
        </div>
      )}
    </div>
  )
})

TeamOField.displayName = 'TeamOField'

export default TeamOField
