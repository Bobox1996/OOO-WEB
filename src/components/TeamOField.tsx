'use client'

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react'
import type { TeamMember, TeamDescription } from '@/types'
import { throttle, placeText } from '@/lib/utils/grid.utils'

interface GridCell {
  char: string
  type: 'o' | 'name' | 'description' | 'team_description'
  span: number
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

  // Build entire grid in a single pass — no cloning, no intermediate states
  const grid = useMemo(() => {
    if (gridRows === 0 || gridCols === 0) return []

    // Allocate grid filled with O's
    const g: GridCell[][] = Array.from({ length: gridRows }, () =>
      Array.from({ length: gridCols }, (): GridCell => ({ char: 'O', type: 'o', span: 1 }))
    )

    // Helper: creates a cell setter for a given type (and optional memberId)
    const makeSetter = (type: GridCell['type'], memberId?: string) =>
      (r: number, c: number, char: string, span: number) => {
        g[r][c] = memberId
          ? { char, type, span, memberId }
          : { char, type, span }
      }

    if (selectedMember) {
      // --- Member detail view ---
      const fullName = `${selectedMember.first_name} ${selectedMember.last_name}`

      // Place member name at row 7 (left-aligned)
      if (7 < gridRows) {
        placeText(makeSetter('name', selectedMember.id), 7, fullName, gridCols, 'left')
      }

      // Place description starting at row 10 (left-aligned)
      if (selectedMember.description) {
        let row = 10
        for (const line of selectedMember.description.split('\n')) {
          if (row >= gridRows) break
          placeText(makeSetter('description'), row, line, gridCols, 'left')
          row++
        }
      }
    } else {
      // --- Initial team view ---
      // Place all member names (centered, 2 rows apart)
      let currentRow = 10
      for (const member of members) {
        if (currentRow >= gridRows) break
        const fullName = `${member.first_name} ${member.last_name}`
        placeText(makeSetter('name', member.id), currentRow, fullName, gridCols, 'center')
        currentRow += 2
      }

      // Place team description below all names (with 2-row gap)
      if (teamDescription?.content) {
        let row = currentRow + 2
        for (const line of teamDescription.content.split('\n')) {
          if (row >= gridRows) break
          placeText(makeSetter('team_description'), row, line, gridCols, 'center')
          row++
        }
      }
    }

    return g
  }, [gridRows, gridCols, selectedMember, members, teamDescription])

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
          <span key={i} className="text-gray-300 cursor-pointer" onClick={() => setSelectedMember(null)}>
            {cell.char}
          </span>
        )
      })}
    </div>
  ), [cellHeight, cellWidth, gridRows, gridCols])

  const renderContentRow = useCallback((row: GridCell[], rowIndex: number, isSecondSet: boolean) => {
    if (!row.some(cell => cell.type !== 'o')) return null
    return (
      <div
        key={isSecondSet ? `c2-${rowIndex - gridRows}` : `c1-${rowIndex}`}
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

          if (cell.type === 'name' && cell.memberId) {
            const isHovered = hoveredMemberId === cell.memberId
            return (
              <span
                key={i}
                className={`cursor-pointer transition-colors pointer-events-auto ${isHovered ? 'text-cyan-500' : 'text-black'}`}
                style={{ gridColumn: `span ${cell.span}` }}
                onClick={() => selectedMember ? setSelectedMember(null) : handleMemberClick(cell.memberId!)}
                onMouseEnter={() => handleMemberHover(cell.memberId!)}
                onMouseLeave={() => handleMemberHover(null)}
              >
                {cell.char}
              </span>
            )
          }

          if (cell.type === 'description' || cell.type === 'team_description') {
            return (
              <span
                key={i}
                className={`text-cyan-500 ${selectedMember ? 'pointer-events-auto cursor-pointer' : ''}`}
                style={{ gridColumn: `span ${cell.span}` }}
                onClick={selectedMember ? () => setSelectedMember(null) : undefined}
              >
                {cell.char}
              </span>
            )
          }

          return <span key={i} className="invisible pointer-events-none">{cell.char}</span>
        })}
      </div>
    )
  }, [cellHeight, cellWidth, gridRows, gridCols, handleMemberClick, handleMemberHover, hoveredMemberId, selectedMember])

  return (
    <div className="relative h-full w-full">
      {/* Hidden element to measure character dimensions */}
      <span
        ref={measureRef}
        className="absolute opacity-0 pointer-events-none font-cjk-mono font-bold text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1]"
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
          className="w-full font-cjk-mono font-bold text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1] select-none relative"
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
          className="absolute top-0 left-0 w-full font-cjk-mono font-bold text-[clamp(1rem,2.5vw,1.5rem)] leading-[1.1] select-none pointer-events-none"
          style={{ height: totalHeight, zIndex: 100 }}
        >
          {visibleGridRows.map(({ row, rowIndex, isSecondSet }) =>
            renderContentRow(row, rowIndex, isSecondSet)
          )}
        </div>
      </div>
    </div>
  )
})

TeamOField.displayName = 'TeamOField'

export default TeamOField
