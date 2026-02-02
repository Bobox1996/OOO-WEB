'use client'

import React, { forwardRef } from 'react'

export interface PatternViewerProps {
  columns: number
  rows: number
  strokeWeight: number
  strokeColor: string
  slogan?: string
  sloganWeight?: number
  sloganColor?: string
  cellSize?: number
}

const PatternViewer = forwardRef<SVGSVGElement, PatternViewerProps>(
  ({ columns, rows, strokeWeight, strokeColor, slogan = '', sloganWeight = 400, sloganColor = '#000000', cellSize = 50 }, ref) => {
    // Calculate grid dimensions based on fixed cell size
    const gridWidth = columns * cellSize
    const gridHeight = rows * cellSize

    // Calculate font size based on cell size (approximately 60% of cell size for good fit)
    const fontSize = cellSize * 0.6

    // Add padding equal to half the font size to accommodate edge text
    const padding = fontSize / 2

    // Generate vertical lines
    const verticalLines = []
    for (let i = 0; i <= columns; i++) {
      verticalLines.push(
        <line
          key={`v-${i}`}
          x1={i * cellSize}
          y1={0}
          x2={i * cellSize}
          y2={gridHeight}
          stroke={strokeColor}
          strokeWidth={strokeWeight}
        />
      )
    }

    // Generate horizontal lines
    const horizontalLines = []
    for (let i = 0; i <= rows; i++) {
      horizontalLines.push(
        <line
          key={`h-${i}`}
          x1={0}
          y1={i * cellSize}
          x2={gridWidth}
          y2={i * cellSize}
          stroke={strokeColor}
          strokeWidth={strokeWeight}
        />
      )
    }

    // Generate text at vertices with multiline support
    const textElements: React.ReactNode[] = []
    const slotsPerRow = columns + 1 // Number of vertices per row
    
    // Split slogan into lines
    const lines = slogan.split('\n')
    let currentRow = 0

    for (const line of lines) {
      if (currentRow > rows) break // No more rows available

      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const col = charIndex % slotsPerRow
        const rowOffset = Math.floor(charIndex / slotsPerRow)
        const targetRow = currentRow + rowOffset

        if (targetRow > rows) break // Exceeded grid rows

        textElements.push(
          <text
            key={`text-${targetRow}-${col}-${textElements.length}`}
            x={col * cellSize}
            y={targetRow * cellSize}
            fontFamily="var(--font-roboto-flex), Roboto Flex, sans-serif"
            fontWeight={sloganWeight}
            fontSize={fontSize}
            fill={sloganColor}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {line[charIndex]}
          </text>
        )
      }

      // Move to next row for the next line
      // Calculate how many rows this line consumed
      const rowsConsumed = line.length > 0 ? Math.ceil(line.length / slotsPerRow) : 0
      currentRow = currentRow + rowsConsumed
      // After a line break, start fresh on the next row
      if (currentRow <= rows) currentRow = Math.max(currentRow, currentRow === 0 ? 1 : currentRow)
    }

    return (
      <svg
        ref={ref}
        viewBox={`${-padding} ${-padding} ${gridWidth + padding * 2} ${gridHeight + padding * 2}`}
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* White background */}
        <rect x={-padding} y={-padding} width={gridWidth + padding * 2} height={gridHeight + padding * 2} fill="white" />
        {/* Grid lines */}
        {verticalLines}
        {horizontalLines}
        {/* Slogan text at vertices */}
        {textElements}
      </svg>
    )
  }
)

PatternViewer.displayName = 'PatternViewer'

export default PatternViewer
