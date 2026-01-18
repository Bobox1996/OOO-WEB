'use client'

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react'

interface LineSegment {
  type: 'o' | 'vision'
  content: string
}

interface VisionOFieldProps {
  oCount: number
  visionContent: string
  onScroll?: (scrollTop: number) => void
}

export interface VisionOFieldRef {
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

const VisionOField = forwardRef<VisionOFieldRef, VisionOFieldProps>(({ oCount, visionContent, onScroll }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textContainerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const textMeasureRef = useRef<HTMLSpanElement>(null)
  const contentHeightRef = useRef(0)
  const [charsPerLine, setCharsPerLine] = useState(50)
  const [visibleLines, setVisibleLines] = useState(0)
  const [lineHeight, setLineHeight] = useState(0)
  const [oCharWidth, setOCharWidth] = useState(0)
  const [visionLines, setVisionLines] = useState<{ text: string; osToReplace: number }[]>([])
  const cursorOverlayRef = useRef<HTMLDivElement>(null)
  
  // Virtualization state - track current scroll position for visible range calculation
  const [scrollTop, setScrollTop] = useState(0)

  // Expose scroll container ref to parent
  useImperativeHandle(ref, () => ({
    scrollContainer: scrollContainerRef.current,
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

  // Measure vision content lines
  useEffect(() => {
    if (!visionContent || !textMeasureRef.current || !measureRef.current || oCharWidth === 0 || charsPerLine === 0) {
      setVisionLines([])
      return
    }

    measureRef.current.textContent = 'O'.repeat(charsPerLine)
    const fullLineOsWidth = measureRef.current.offsetWidth

    const rawLines = visionContent.split('\n')
    const processedLines: { text: string; osToReplace: number }[] = []

    rawLines.forEach(rawLine => {
      if (!rawLine.trim()) {
        processedLines.push({ text: '', osToReplace: 0 })
        return
      }

      textMeasureRef.current!.textContent = rawLine
      const lineWidth = textMeasureRef.current!.offsetWidth

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
          textMeasureRef.current!.textContent = testLine
          const testWidth = textMeasureRef.current!.offsetWidth

          if (testWidth <= fullLineOsWidth) {
            currentLine = testLine
          } else {
            if (currentLine) {
              textMeasureRef.current!.textContent = currentLine
              const currentWidth = textMeasureRef.current!.offsetWidth
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
          textMeasureRef.current!.textContent = currentLine
          const currentWidth = textMeasureRef.current!.offsetWidth
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
    textMeasureRef.current.textContent = ''

    setVisionLines(processedLines)
  }, [visionContent, oCharWidth, charsPerLine])

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
    
    // Update virtualization scroll position (throttled)
    throttledSetScrollTop(currentScrollTop)
  }, [onScroll, updateCursorPos, throttledSetScrollTop])

  // Build lines with vision text centered
  const buildVisionLines = useCallback((): LineSegment[][] => {
    const lines: LineSegment[][] = []
    
    // Initialize all lines as pure O's
    for (let i = 0; i < totalLines; i++) {
      lines.push([{ type: 'o', content: 'O'.repeat(charsPerLine) }])
    }
    
    // If no vision content, return pure O lines
    if (visionLines.length === 0) {
      return lines
    }
    
    // Start vision text from line 10 (index 9)
    const visionStartLine = 9
    
    visionLines.forEach((visionLine, idx) => {
      const targetLine = visionStartLine + idx
      if (targetLine < totalLines) {
        const newSegments: LineSegment[] = []
        
        if (visionLine.text) {
          // Calculate start position to CENTER the text
          const startPos = Math.floor((charsPerLine - visionLine.osToReplace) / 2)
          
          // Add leading O's
          if (startPos > 0) {
            newSegments.push({ type: 'o', content: 'O'.repeat(startPos) })
          }
          
          // Add vision text
          newSegments.push({ type: 'vision', content: visionLine.text })
          
          // Add trailing O's
          const endPos = startPos + visionLine.osToReplace
          if (endPos < charsPerLine) {
            newSegments.push({ type: 'o', content: 'O'.repeat(charsPerLine - endPos) })
          }
        } else {
          // Empty line - just O's
          newSegments.push({ type: 'o', content: 'O'.repeat(charsPerLine) })
        }
        
        lines[targetLine] = newSegments
      }
    })
    
    return lines
  }, [totalLines, charsPerLine, visionLines])

  // Generate all lines (memoized)
  const allLines = useMemo(() => buildVisionLines(), [buildVisionLines])

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
          if (segment.type === 'vision') {
            // Render invisible placeholder to maintain spacing
            return <span key={j} className="invisible">{segment.content}</span>
          } else {
            return <span key={j}>{segment.content}</span>
          }
        })}
      </div>
    )
  }, [lineHeight, totalLines])

  // Render a single line with only vision text (for top layer unaffected by cursor overlay)
  const renderVisionOnlyLine = useCallback((lineSegments: LineSegment[], index: number, isSecondSet: boolean) => {
    const key = isSecondSet ? `vision-second-${index - totalLines}` : `vision-first-${index}`
    
    // Check if this line has any vision segments
    const hasVision = lineSegments.some(s => s.type === 'vision')
    if (!hasVision) return null
    
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
          if (segment.type === 'vision') {
            return (
              <span key={j} className="text-cyan-500">
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
  }, [lineHeight, totalLines])

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

  return (
    <div 
      ref={containerRef} 
      className="relative h-full w-full"
    >
      {/* Hidden element to measure character width */}
      <span 
        ref={measureRef}
        className="absolute opacity-0 pointer-events-none font-bold text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1] tracking-tight"
        aria-hidden="true"
      >
        O
      </span>
      {/* Hidden element to measure text widths */}
      <span 
        ref={textMeasureRef}
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

        {/* Layer 3: Vision text only (top layer - NOT affected by cursor overlay) */}
        <div 
          className="absolute top-0 left-0 w-full font-bold text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1] tracking-tight select-none pointer-events-none"
          style={{ height: totalHeight, zIndex: 100 }}
        >
          {visibleLinesData.map(({ lineSegments, index, isSecondSet }) => 
            renderVisionOnlyLine(lineSegments, index, isSecondSet)
          )}
        </div>
      </div>
    </div>
  )
})

VisionOField.displayName = 'VisionOField'

export default VisionOField
