'use client'

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
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

const TeamOField = forwardRef<TeamOFieldRef, TeamOFieldProps>(({ oCount, members, onScroll }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textContainerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const nameMeasureRef = useRef<HTMLSpanElement>(null)
  const contentHeightRef = useRef(0)
  const [charsPerLine, setCharsPerLine] = useState(50)
  const [visibleLines, setVisibleLines] = useState(0)
  const [lineHeight, setLineHeight] = useState(0)
  const [oCharWidth, setOCharWidth] = useState(0)
  const [memberMeasurements, setMemberMeasurements] = useState<Map<string, { name: string; osToReplace: number }>>(new Map())
  const [descriptionLines, setDescriptionLines] = useState<{ text: string; osToReplace: number }[]>([])
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)

  // Create a map for quick member lookup by ID
  const memberMap = new Map(members.map(m => [m.id, m]))

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
          
          // Line height is based on the character height with leading
          // leading-[1.1] means lineHeight = fontSize * 1.1
          const computedLineHeight = charHeight
          setLineHeight(computedLineHeight)
          
          // Calculate how many lines fit in the viewport
          const visible = Math.floor(viewportHeight / computedLineHeight)
          setVisibleLines(visible > 0 ? visible : 10)
        }
      }
    }
    
    // Calculate after a short delay to ensure elements are rendered
    const timer = setTimeout(calculate, 50)
    
    window.addEventListener('resize', calculate)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', calculate)
    }
  }, [])

  // Measure content height after mount (half of total scrollable height since content is duplicated)
  useEffect(() => {
    const measureHeight = () => {
      if (scrollContainerRef.current) {
        // Total scroll height is double the content, so divide by 2
        const totalHeight = scrollContainerRef.current.scrollHeight
        contentHeightRef.current = totalHeight / 2
      }
    }
    
    // Measure after a short delay to ensure content is rendered
    const timer = setTimeout(measureHeight, 100)
    
    // Also measure on resize
    window.addEventListener('resize', measureHeight)
    
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', measureHeight)
    }
  }, [oCount])

  // Measure each member's name width and calculate Os to replace
  useEffect(() => {
    if (!nameMeasureRef.current || !measureRef.current || oCharWidth === 0 || members.length === 0) return

    const measurements = new Map<string, { name: string; osToReplace: number }>()
    
    members.forEach(member => {
      const nameText = `${member.first_name} ${member.last_name}`
      
      // Measure the name width
      nameMeasureRef.current!.textContent = nameText
      const nameWidth = nameMeasureRef.current!.offsetWidth
      
      // Binary search to find the minimum number of O's that fit the name width
      // This accounts for tracking-tight letter-spacing effects on multi-char strings
      let osToReplace = Math.ceil(nameWidth / oCharWidth)
      
      // Verify by measuring actual O's and increase if needed
      measureRef.current!.textContent = 'O'.repeat(osToReplace)
      let osWidth = measureRef.current!.offsetWidth
      
      // Keep adding O's until we have enough width to cover the name
      while (osWidth < nameWidth && osToReplace < 100) {
        osToReplace++
        measureRef.current!.textContent = 'O'.repeat(osToReplace)
        osWidth = measureRef.current!.offsetWidth
      }
      
      measurements.set(member.id, { name: nameText, osToReplace })
      
      // Reset measure ref back to single O
      measureRef.current!.textContent = 'O'
    })
    
    // Clear the measurement element
    nameMeasureRef.current.textContent = ''
    
    setMemberMeasurements(measurements)
  }, [members, oCharWidth])

  // Measure description lines when a member is selected
  useEffect(() => {
    if (!selectedMember?.description || !nameMeasureRef.current || !measureRef.current || oCharWidth === 0 || charsPerLine === 0) {
      setDescriptionLines([])
      return
    }

    // Measure the width of a full line of O's
    measureRef.current.textContent = 'O'.repeat(charsPerLine)
    const fullLineOsWidth = measureRef.current.offsetWidth

    // Split description by newlines
    const rawLines = selectedMember.description.split('\n')
    const processedLines: { text: string; osToReplace: number }[] = []

    rawLines.forEach(rawLine => {
      if (!rawLine.trim()) {
        // Empty line - just add a blank line
        processedLines.push({ text: '', osToReplace: 0 })
        return
      }

      // Measure the line width
      nameMeasureRef.current!.textContent = rawLine
      const lineWidth = nameMeasureRef.current!.offsetWidth

      if (lineWidth <= fullLineOsWidth) {
        // Line fits - calculate O's to replace
        let osToReplace = Math.ceil(lineWidth / oCharWidth)
        
        // Verify by measuring actual O's
        measureRef.current!.textContent = 'O'.repeat(osToReplace)
        let osWidth = measureRef.current!.offsetWidth
        
        while (osWidth < lineWidth && osToReplace < charsPerLine) {
          osToReplace++
          measureRef.current!.textContent = 'O'.repeat(osToReplace)
          osWidth = measureRef.current!.offsetWidth
        }

        processedLines.push({ text: rawLine, osToReplace })
      } else {
        // Line too long - need to wrap
        // Split at word boundaries
        const words = rawLine.split(' ')
        let currentLine = ''
        
        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word
          nameMeasureRef.current!.textContent = testLine
          const testWidth = nameMeasureRef.current!.offsetWidth

          if (testWidth <= fullLineOsWidth) {
            currentLine = testLine
          } else {
            // Push current line and start new one
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

        // Don't forget the last line
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

    // Reset measurement elements
    measureRef.current.textContent = 'O'
    nameMeasureRef.current.textContent = ''

    setDescriptionLines(processedLines)
  }, [selectedMember, oCharWidth, charsPerLine])

  // Handle infinite scroll loop
  const handleScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current
    const contentHeight = contentHeightRef.current
    if (!scrollContainer || contentHeight === 0) return

    const scrollTop = scrollContainer.scrollTop

    // Call onScroll callback for parent to sync title position
    onScroll?.(scrollTop)

    // When we've scrolled past the first content block, reset to beginning
    if (scrollTop >= contentHeight) {
      scrollContainer.scrollTop = scrollTop - contentHeight
    }
    // When scrolling up past the start, jump to the end
    else if (scrollTop <= 0) {
      scrollContainer.scrollTop = contentHeight + scrollTop
    }
  }, [onScroll])

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

  // Build lines with member names inserted at random positions (one name per line)
  const buildLinesWithNames = useCallback((): LineSegment[][] => {
    const totalLines = Math.ceil(oCount / charsPerLine)
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
      
      // Skip if we've run out of available lines
      if (usedLines.size >= maxAvailableLines) return
      
      // Pick a random line within visible lines range, avoiding used lines
      let seed = member.id.charCodeAt(0) + memberIndex
      let lineIndex: number
      let attempts = 0
      do {
        lineIndex = Math.floor(seededRandom(seed) * maxAvailableLines)
        seed++
        attempts++
      } while (usedLines.has(lineIndex) && attempts < 100)
      
      // Mark this line as used
      usedLines.add(lineIndex)
      
      // Pick a random position within the line (ensuring name fits)
      const maxStartPos = Math.max(0, charsPerLine - measurement.osToReplace)
      const startPos = Math.floor(seededRandom(seed + 1) * maxStartPos)
      
      // Build new segments for this line
      const newSegments: LineSegment[] = []
      
      // Insert name at position (replace O's with name)
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
  }, [oCount, charsPerLine, members, memberMeasurements, visibleLines, seededRandom])

  // Build lines for selected state (only selected name at line 10, description at line 13+)
  const buildSelectedLines = useCallback((): LineSegment[][] => {
    const totalLines = Math.ceil(oCount / charsPerLine)
    const lines: LineSegment[][] = []
    
    // Initialize all lines as pure O's
    for (let i = 0; i < totalLines; i++) {
      lines.push([{ type: 'o', content: 'O'.repeat(charsPerLine) }])
    }
    
    if (!selectedMember) return lines
    
    const measurement = memberMeasurements.get(selectedMember.id)
    if (!measurement) return lines
    
    // Place selected name at the start of line 9 (10th line, 0-indexed)
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
    
    // Insert description lines starting 3 lines below the name (line 12, 0-indexed)
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
          // Empty description line - keep as pure O's
          newSegments.push({ type: 'o', content: 'O'.repeat(charsPerLine) })
        }
        
        lines[targetLine] = newSegments
      }
    })
    
    return lines
  }, [oCount, charsPerLine, selectedMember, memberMeasurements, descriptionLines])

  // Generate lines based on selection state
  const linesWithNames = selectedMember ? buildSelectedLines() : buildLinesWithNames()

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
      >
        {/* Lines container with content duplicated for seamless loop */}
        <div 
          ref={textContainerRef}
          className="w-full font-bold text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1] tracking-tight select-none text-black"
        >
          {/* First set of lines */}
          {linesWithNames.map((lineSegments, i) => (
            <div key={`first-${i}`} className="whitespace-nowrap overflow-hidden">
              {lineSegments.map((segment, j) => {
                if (segment.type === 'name') {
                  return (
                    <span 
                      key={j} 
                      className="text-green-500 cursor-pointer hover:opacity-70 transition-opacity"
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
                  return <span key={j}>{segment.content}</span>
                }
              })}
            </div>
          ))}
          {/* Duplicated lines for infinite scroll */}
          {linesWithNames.map((lineSegments, i) => (
            <div key={`second-${i}`} className="whitespace-nowrap overflow-hidden">
              {lineSegments.map((segment, j) => {
                if (segment.type === 'name') {
                  return (
                    <span 
                      key={j} 
                      className="text-green-500 cursor-pointer hover:opacity-70 transition-opacity"
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
                  return <span key={j}>{segment.content}</span>
                }
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Portrait overlay when member is selected */}
      {selectedMember && selectedMember.portrait_url && (
        <div 
          className="fixed inset-x-0 bottom-0 pointer-events-none z-50"
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
