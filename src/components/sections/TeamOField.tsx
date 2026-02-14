'use client'

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react'
import type { TeamMember, TeamDescription } from '@/types'
import { throttle, placeText, visualWidth, wrapText } from '@/lib/utils/grid.utils'

interface GridCell {
  char: string
  type: 'o' | 'name' | 'description' | 'team_description'
  span: number
  memberId?: string
}

interface TextPlacement {
  row: number
  startCol: number
  totalSpan: number
  text: string
  type: 'name' | 'description' | 'team_description'
  memberId?: string
}

interface TeamOFieldProps {
  oCount: number
  members: TeamMember[]
  teamDescription: TeamDescription | null
  onScroll?: (scrollTop: number) => void
}

export interface TeamOFieldRef {
  scrollContainer: HTMLDivElement | null
  resetSelection: () => void
}

const RENDER_BUFFER = 5

const TeamOField = forwardRef<TeamOFieldRef, TeamOFieldProps>(({ oCount, members, teamDescription, onScroll }, ref) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const contentHeightRef = useRef(0)
  const cursorOverlayRef = useRef<HTMLDivElement>(null)
  const mouseClientPos = useRef<{ x: number; y: number } | null>(null)

  // Only DOM-derived values need state (set by measurement effect)
  const [gridCols, setGridCols] = useState(50)
  const [cellWidth, setCellWidth] = useState(0)
  const [cellHeight, setCellHeight] = useState(0)
  const [visibleRows, setVisibleRows] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)

  // Interactive state
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null)

  // Shuffle members and randomize row gaps once on mount
  const [shuffledData] = useState(() => {
    const arr = [...members]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    const gaps = arr.map(() => Math.floor(Math.random() * 3)) // 0, 1, or 2 row gap
    const offsets = arr.map(() => Math.random() * 2 - 1) // float in [-1, 1]
    return { shuffled: arr, gaps, offsets }
  })

  useImperativeHandle(ref, () => ({
    scrollContainer: scrollContainerRef.current,
    resetSelection: () => setSelectedMember(null),
  }))

  // --- Derived values ---
  const gridRows = gridCols > 0 ? Math.ceil(oCount / gridCols) : 0

  // Sync content height ref (read by scroll handler, so must stay a ref)
  useEffect(() => {
    contentHeightRef.current = gridRows > 0 && cellHeight > 0 ? gridRows * cellHeight : 0
  }, [gridRows, cellHeight])

  // Build entire grid + text placements in a single pass
  const { grid, placements } = useMemo(() => {
    if (gridRows === 0 || gridCols === 0) return { grid: [] as GridCell[][], placements: [] as TextPlacement[] }

    // Allocate grid filled with O's
    const g: GridCell[][] = Array.from({ length: gridRows }, () =>
      Array.from({ length: gridCols }, (): GridCell => ({ char: 'O', type: 'o', span: 1 }))
    )
    const p: TextPlacement[] = []

    // Helper: creates a cell setter for a given type (and optional memberId)
    // Cells are marked with the type so Layer 1 hides O's, but char is empty (rendered by placements instead)
    const makeSetter = (type: GridCell['type'], memberId?: string) =>
      (r: number, c: number, _char: string, span: number) => {
        g[r][c] = memberId
          ? { char: '', type, span, memberId }
          : { char: '', type, span }
      }

    // Helper: place text, record cell occupancy + push a TextPlacement
    const placeAndRecord = (
      type: TextPlacement['type'],
      row: number,
      text: string,
      align: 'center' | 'left',
      memberId?: string,
      offset?: number,
    ) => {
      const { startCol, totalSpan } = placeText(makeSetter(type, memberId), row, text, gridCols, align, offset)
      p.push({ row, startCol, totalSpan, text, type, memberId })
    }

    // Helper: wrap text that overflows gridCols across multiple rows
    const placeWrapped = (
      type: TextPlacement['type'],
      startRow: number,
      text: string,
      align: 'center' | 'left',
      memberId?: string,
      offset?: number,
    ): number => {
      const segments = wrapText(text, gridCols)
      for (const segment of segments) {
        if (startRow >= gridRows) break
        placeAndRecord(type, startRow, segment, align, memberId, offset)
        startRow++
      }
      return startRow
    }

    if (selectedMember) {
      // --- Member detail view ---
      const fullName = `${selectedMember.first_name} ${selectedMember.last_name}`

      // Place member name at row 7 (left-aligned, wraps if needed)
      let nextRow = 7
      if (nextRow < gridRows) {
        nextRow = placeWrapped('name', nextRow, fullName, 'left', selectedMember.id)
      }

      // Place description starting at row 10 or after name if it wrapped past 10 (left-aligned)
      if (selectedMember.description) {
        let row = Math.max(10, nextRow + 1)
        for (const line of selectedMember.description.split('\n')) {
          if (row >= gridRows) break
          row = placeWrapped('description', row, line, 'left')
        }
      }
    } else {
      // --- Initial team view ---
      // Place all member names (centered with random horizontal offset, randomized order and row gaps)
      let currentRow = 10
      shuffledData.shuffled.forEach((member, idx) => {
        if (currentRow >= gridRows) return
        const fullName = `${member.first_name} ${member.last_name}`
        // Compute offset based on the first (possibly only) wrapped segment
        const firstSegment = wrapText(fullName, gridCols)[0]
        const totalSpan = visualWidth(firstSegment)
        const centeredStart = Math.floor((gridCols - totalSpan) / 2)
        const n = centeredStart                        // O's on left when centered
        const m = gridCols - centeredStart - totalSpan // O's on right when centered
        const maxShift = Math.floor(Math.min(Math.max(n, 0), Math.max(m, 0))*2 / 3)
        const shift = Math.round(shuffledData.offsets[idx] * maxShift)
        const afterRow = placeWrapped('name', currentRow, fullName, 'center', member.id, shift)
        const rowsUsed = afterRow - currentRow
        currentRow += Math.max(rowsUsed, 1) + shuffledData.gaps[idx] // gap of 0-2 rows between names
      })

      // Place team description below all names (with 2-row gap)
      if (teamDescription?.content) {
        let row = currentRow + 2
        for (const line of teamDescription.content.split('\n')) {
          if (row >= gridRows) break
          row = placeWrapped('team_description', row, line, 'center')
        }
      }
    }

    return { grid: g, placements: p }
  }, [gridRows, gridCols, selectedMember, shuffledData, teamDescription])

  // --- DOM measurement (the only real effect needed) ---
  useEffect(() => {
    const calculate = () => {
      if (!gridContainerRef.current || !measureRef.current || !scrollContainerRef.current) return
      const containerWidth = gridContainerRef.current.offsetWidth
      const cw = measureRef.current.offsetWidth
      const ch = measureRef.current.offsetHeight
      const viewportHeight = scrollContainerRef.current.offsetHeight

      if (cw > 0 && ch > 0) {
        const cols = Math.floor(containerWidth / cw)
        setGridCols(cols > 0 ? cols : 50)
        setCellWidth(cw)
        setCellHeight(ch)
        setVisibleRows(Math.max(Math.floor(viewportHeight / ch), 10))
      }
    }

    const timer = setTimeout(calculate, 50)
    window.addEventListener('resize', calculate)
    return () => { clearTimeout(timer); window.removeEventListener('resize', calculate) }
  }, [members, selectedMember, teamDescription])

  // --- Virtualization ---
  const { visibleStart, visibleEnd, totalHeight } = useMemo(() => {
    if (cellHeight === 0 || gridRows === 0) {
      return { visibleStart: 0, visibleEnd: Math.min(20, gridRows), totalHeight: 0 }
    }
    const height = gridRows * cellHeight * 2
    const start = Math.max(0, Math.floor(scrollTop / cellHeight) - RENDER_BUFFER)
    const end = Math.min(gridRows * 2, Math.ceil((scrollTop + visibleRows * cellHeight) / cellHeight) + RENDER_BUFFER)
    return { visibleStart: start, visibleEnd: end, totalHeight: height }
  }, [scrollTop, cellHeight, gridRows, visibleRows])

  const visibleGridRows = useMemo(() => {
    const result: { row: GridCell[]; rowIndex: number; isSecondSet: boolean }[] = []
    for (let i = visibleStart; i < visibleEnd; i++) {
      const isSecondSet = i >= gridRows
      const actualIndex = isSecondSet ? i - gridRows : i
      if (actualIndex >= 0 && actualIndex < grid.length) {
        result.push({ row: grid[actualIndex], rowIndex: i, isSecondSet })
      }
    }
    return result
  }, [visibleStart, visibleEnd, gridRows, grid])

  // --- Event handlers ---
  const handleMemberClick = useCallback((memberId: string) => {
    const member = members.find(m => m.id === memberId)
    if (member) setSelectedMember(member)
  }, [members])

  const handleMemberHover = useCallback((memberId: string | null) => {
    setHoveredMemberId(memberId)
  }, [])

  // --- Cursor & scroll handlers ---
  const updateCursorPos = useCallback(() => {
    if (scrollContainerRef.current && mouseClientPos.current && cursorOverlayRef.current) {
      const rect = scrollContainerRef.current.getBoundingClientRect()
      const x = mouseClientPos.current.x - rect.left
      const y = mouseClientPos.current.y - rect.top + scrollContainerRef.current.scrollTop
      cursorOverlayRef.current.style.transform = `translate3d(${x - 250}px, ${y - 250}px, 0)`
      cursorOverlayRef.current.style.display = 'block'
    }
  }, [])

  const throttledSetScrollTop = useMemo(() => throttle((v: number) => setScrollTop(v), 16), [])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    const ch = contentHeightRef.current
    if (!el || ch === 0) return

    let st = el.scrollTop
    onScroll?.(st)
    updateCursorPos()

    if (st >= ch) {
      st -= ch
      el.scrollTop = st
    }
    throttledSetScrollTop(st)
  }, [onScroll, updateCursorPos, throttledSetScrollTop])

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

  const handleMouseLeave = useCallback(() => {
    mouseClientPos.current = null
    if (cursorOverlayRef.current) cursorOverlayRef.current.style.display = 'none'
  }, [])

  // --- Row renderers ---
  const renderOsOnlyRow = useCallback((row: GridCell[], rowIndex: number, isSecondSet: boolean) => (
    <div
      key={isSecondSet ? `o2-${rowIndex - gridRows}` : `o1-${rowIndex}`}
      className="absolute left-0 right-0 grid"
      style={{
        height: cellHeight || 'auto',
        top: rowIndex * cellHeight,
        gridTemplateColumns: `repeat(${gridCols}, ${cellWidth}px)`,
        willChange: 'transform',
      }}
    >
      {row.map((cell, i) => {
        if (cell.span === 0) return null
        if (cell.type !== 'o') {
          return <span key={i} className="invisible" style={{ gridColumn: `span ${cell.span}` }}>{cell.char}</span>
        }
        return (
          <span key={i} className="text-gray-300/90 cursor-pointer" onClick={() => setSelectedMember(null)}>
            {cell.char}
          </span>
        )
      })}
    </div>
  ), [cellHeight, cellWidth, gridRows, gridCols])

  // --- Visible text placements (for both grid copies, filtered by scroll) ---
  const visiblePlacements = useMemo(() => {
    if (cellHeight === 0 || placements.length === 0) return []

    const result: { placement: TextPlacement; top: number; key: string; placementIndex: number }[] = []
    for (let idx = 0; idx < placements.length; idx++) {
      const p = placements[idx]
      // First copy
      if (p.row >= visibleStart && p.row < visibleEnd) {
        result.push({ placement: p, top: p.row * cellHeight, key: `p1-${p.row}-${p.startCol}`, placementIndex: idx })
      }
      // Second copy (offset by gridRows for infinite scroll)
      const secondRow = p.row + gridRows
      if (secondRow >= visibleStart && secondRow < visibleEnd) {
        result.push({ placement: p, top: secondRow * cellHeight, key: `p2-${p.row}-${p.startCol}`, placementIndex: idx })
      }
    }
    return result
  }, [placements, visibleStart, visibleEnd, cellHeight, gridRows])

  return (
    <div className="relative h-full w-full">
      {/* Hidden element to measure character dimensions */}
      <span
        ref={measureRef}
        className="absolute opacity-0 pointer-events-none font-cjk-mono font-bold text-[clamp(0.9rem,2.25vw,1.35rem)] md:text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1]"
        aria-hidden="true"
      >
        O
      </span>

      {/* Infinite scroll container */}
      <div
        ref={scrollContainerRef}
        className="infinite-scroll-container"
        onScroll={handleScroll}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Layer 1: O characters (affected by cursor overlay) */}
        <div
          ref={gridContainerRef}
          className="w-full font-cjk-mono font-bold text-[clamp(0.9rem,2.25vw,1.35rem)] md:text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1] select-none relative"
          style={{ height: totalHeight, zIndex: 1 }}
        >
          {visibleGridRows.map(({ row, rowIndex, isSecondSet }) =>
            renderOsOnlyRow(row, rowIndex, isSecondSet)
          )}
        </div>

        {/* Layer 2: Cursor mask overlay */}
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

        {/* Layer 3: Content (names/descriptions, NOT affected by cursor overlay) */}
        <div
          className="absolute top-0 left-0 w-full font-bold text-[clamp(0.9rem,2.25vw,1.35rem)] md:text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1] select-none pointer-events-none"
          style={{ height: totalHeight, zIndex: 100 }}
        >
          {visiblePlacements.map(({ placement, top, key, placementIndex }) => {
            const isName = placement.type === 'name' && placement.memberId
            const isHovered = isName && hoveredMemberId === placement.memberId

            return (
              <div
                key={key}
                className="absolute whitespace-nowrap line-slide"
                style={{
                  top,
                  left: placement.startCol * cellWidth,
                  width: placement.totalSpan * cellWidth,
                  height: cellHeight,
                  lineHeight: `${cellHeight}px`,
                  zIndex: placements.length - placementIndex,
                  '--box-w': `${placement.totalSpan * cellWidth}px`,
                } as React.CSSProperties}
              >
                <span
                  className={
                    isName
                      ? `txt cursor-pointer transition-colors pointer-events-auto ${isHovered ? 'text-orange-500' : 'text-black'}`
                      : `txt text-cyan-500 ${selectedMember ? 'pointer-events-auto cursor-pointer' : ''}`
                  }
                  onClick={
                    isName
                      ? () => selectedMember ? setSelectedMember(null) : handleMemberClick(placement.memberId!)
                      : selectedMember ? () => setSelectedMember(null) : undefined
                  }
                  onMouseEnter={isName ? () => handleMemberHover(placement.memberId!) : undefined}
                  onMouseLeave={isName ? () => handleMemberHover(null) : undefined}
                >
                  {placement.text}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

TeamOField.displayName = 'TeamOField'

export default TeamOField
