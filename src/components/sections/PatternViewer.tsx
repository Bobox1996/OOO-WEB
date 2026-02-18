'use client'

import React, { forwardRef, useMemo } from 'react'

export interface LogoOverlayData {
  svgContent: string
  x: number
  y: number
  scale: number
  rotation: number
  fillColor: string
  strokeColor: string
  strokeWidth: number
  nativeWidth: number
  nativeHeight: number
  nativeMinX: number
  nativeMinY: number
}

export interface PatternViewerProps {
  columns: number
  rows: number
  strokeWeight: number
  strokeColor: string
  slogan?: string
  sloganFont?: string
  sloganWeight?: number
  sloganColor?: string
  rotationRandom?: number
  positionRandom?: number
  randomSeed?: number
  cellSize?: number
  logoOverlay?: LogoOverlayData | null
  logoSelected?: boolean
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

const SHAPE_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'text', 'tspan'])
const SKIP_TAGS = new Set(['defs', 'clippath', 'mask', 'pattern', 'lineargradient', 'radialgradient', 'stop', 'style', 'title', 'desc', 'metadata', 'symbol', 'filter'])

function recolorSvg(svgContent: string, fillColor: string, strokeColor: string, sw: number): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`,
    'image/svg+xml',
  )
  const svg = doc.querySelector('svg')
  if (!svg) return svgContent

  const els = svg.querySelectorAll('*')
  for (const el of els) {
    const tag = el.tagName.toLowerCase()
    if (SKIP_TAGS.has(tag)) continue

    const curFill = el.getAttribute('fill')
    if (curFill && curFill !== 'none' && curFill !== 'transparent') {
      el.setAttribute('fill', fillColor)
    } else if (!curFill && SHAPE_TAGS.has(tag)) {
      el.setAttribute('fill', fillColor)
    }

    if (strokeColor !== 'none') {
      const curStroke = el.getAttribute('stroke')
      if (curStroke && curStroke !== 'none' && curStroke !== 'transparent') {
        el.setAttribute('stroke', strokeColor)
      }
    }

    if (el.hasAttribute('stroke-width')) {
      el.setAttribute('stroke-width', String(sw))
    } else if (el.hasAttribute('stroke') && el.getAttribute('stroke') !== 'none') {
      el.setAttribute('stroke-width', String(sw))
    }

    const style = el.getAttribute('style')
    if (style) {
      let s = style
      s = s.replace(/fill\s*:\s*(?!none|transparent)[^;}"']+/gi, `fill:${fillColor}`)
      if (strokeColor !== 'none') {
        s = s.replace(/stroke\s*:\s*(?!none|transparent)[^;}"']+/gi, `stroke:${strokeColor}`)
      }
      s = s.replace(/stroke-width\s*:\s*[^;}"']+/gi, `stroke-width:${sw}`)
      el.setAttribute('style', s)
    }
  }

  return svg.innerHTML
}

const PatternViewer = forwardRef<SVGSVGElement, PatternViewerProps>(
  ({ columns, rows, strokeWeight, strokeColor, slogan = '', sloganFont = 'var(--font-inter), Inter, sans-serif', sloganWeight = 400, sloganColor = '#000000', rotationRandom = 0, positionRandom = 0, randomSeed = 0, cellSize = 50, logoOverlay, logoSelected }, ref) => {
    const gridWidth = columns * cellSize
    const gridHeight = rows * cellSize
    const fontSize = cellSize * 0.6
    const padding = fontSize / 2

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

    const textElements: React.ReactNode[] = []
    const slotsPerRow = columns + 1
    const lines = slogan.split('\n')
    let currentRow = 0

    for (const line of lines) {
      if (currentRow > rows) break

      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const col = charIndex % slotsPerRow
        const rowOffset = Math.floor(charIndex / slotsPerRow)
        const targetRow = currentRow + rowOffset

        if (targetRow > rows) break

        const vx = col * cellSize
        const vy = targetRow * cellSize

        const charSeed = targetRow * 1000 + col + randomSeed * 13397
        const angle = rotationRandom > 0
          ? (seededRandom(charSeed) * 2 - 1) * rotationRandom
          : 0
        const offsetX = positionRandom > 0
          ? (seededRandom(charSeed + 7919) * 2 - 1) * positionRandom * cellSize
          : 0
        const offsetY = positionRandom > 0
          ? (seededRandom(charSeed + 6271) * 2 - 1) * positionRandom * cellSize
          : 0

        const needsTransform = angle !== 0 || offsetX !== 0 || offsetY !== 0

        textElements.push(
          <text
            key={`text-${targetRow}-${col}-${textElements.length}`}
            x={vx}
            y={vy}
            fontFamily={sloganFont}
            fontWeight={sloganWeight}
            fontSize={fontSize}
            fill={sloganColor}
            textAnchor="middle"
            dominantBaseline="middle"
            {...(needsTransform ? { transform: `translate(${offsetX}, ${offsetY}) rotate(${angle}, ${vx}, ${vy})` } : {})}
          >
            {line[charIndex]}
          </text>
        )
      }

      const rowsConsumed = line.length > 0 ? Math.ceil(line.length / slotsPerRow) : 0
      currentRow = currentRow + rowsConsumed
      if (currentRow <= rows) currentRow = Math.max(currentRow, currentRow === 0 ? 1 : currentRow)
    }

    const recoloredContent = useMemo(() => {
      if (!logoOverlay) return ''
      return recolorSvg(logoOverlay.svgContent, logoOverlay.fillColor, logoOverlay.strokeColor, logoOverlay.strokeWidth)
    }, [logoOverlay?.svgContent, logoOverlay?.fillColor, logoOverlay?.strokeColor, logoOverlay?.strokeWidth])

    const bboxMetrics = useMemo(() => {
      if (!logoOverlay) return null
      const { nativeWidth: nw, nativeHeight: nh } = logoOverlay
      const halfW = nw / 2
      const halfH = nh / 2
      const maxDim = Math.max(nw, nh)
      const handleSize = Math.max(maxDim * 0.06, 3)
      const handleHalf = handleSize / 2
      const bboxStroke = Math.max(maxDim * 0.012, 0.5)
      const dashSize = Math.max(maxDim * 0.03, 1)
      const rotOffset = maxDim * 0.12
      const rotRadius = handleSize * 0.7

      return { halfW, halfH, handleSize, handleHalf, bboxStroke, dashSize, rotOffset, rotRadius }
    }, [logoOverlay?.nativeWidth, logoOverlay?.nativeHeight])

    return (
      <svg
        ref={ref}
        viewBox={`${-padding} ${-padding} ${gridWidth + padding * 2} ${gridHeight + padding * 2}`}
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        overflow="visible"
      >
        <rect x={-padding} y={-padding} width={gridWidth + padding * 2} height={gridHeight + padding * 2} fill="white" />
        {verticalLines}
        {horizontalLines}
        {textElements}

        {logoOverlay && (
          <g
            className="logo-draggable"
            transform={`translate(${logoOverlay.x}, ${logoOverlay.y}) rotate(${logoOverlay.rotation}) scale(${logoOverlay.scale})`}
            style={{ cursor: logoSelected ? 'move' : 'pointer' }}
          >
            <rect
              x={-logoOverlay.nativeWidth / 2}
              y={-logoOverlay.nativeHeight / 2}
              width={logoOverlay.nativeWidth}
              height={logoOverlay.nativeHeight}
              fill="transparent"
            />
            <g
              transform={`translate(${-logoOverlay.nativeMinX - logoOverlay.nativeWidth / 2}, ${-logoOverlay.nativeMinY - logoOverlay.nativeHeight / 2})`}
              dangerouslySetInnerHTML={{ __html: recoloredContent }}
            />
          </g>
        )}

        {logoOverlay && logoSelected && bboxMetrics && (
          <g transform={`translate(${logoOverlay.x}, ${logoOverlay.y}) rotate(${logoOverlay.rotation}) scale(${logoOverlay.scale})`}>
            <rect
              x={-bboxMetrics.halfW}
              y={-bboxMetrics.halfH}
              width={logoOverlay.nativeWidth}
              height={logoOverlay.nativeHeight}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={bboxMetrics.bboxStroke}
              strokeDasharray={`${bboxMetrics.dashSize} ${bboxMetrics.dashSize}`}
              pointerEvents="none"
            />

            {[
              { id: 'tl', cx: -bboxMetrics.halfW, cy: -bboxMetrics.halfH },
              { id: 'tr', cx: bboxMetrics.halfW, cy: -bboxMetrics.halfH },
              { id: 'bl', cx: -bboxMetrics.halfW, cy: bboxMetrics.halfH },
              { id: 'br', cx: bboxMetrics.halfW, cy: bboxMetrics.halfH },
            ].map((corner) => (
              <rect
                key={corner.id}
                className="logo-scale-handle"
                data-corner={corner.id}
                x={corner.cx - bboxMetrics.handleHalf}
                y={corner.cy - bboxMetrics.handleHalf}
                width={bboxMetrics.handleSize}
                height={bboxMetrics.handleSize}
                fill="white"
                stroke="#3b82f6"
                strokeWidth={bboxMetrics.bboxStroke}
                style={{ cursor: 'pointer' }}
              />
            ))}

            <line
              x1={0}
              y1={-bboxMetrics.halfH}
              x2={0}
              y2={-bboxMetrics.halfH - bboxMetrics.rotOffset}
              stroke="#3b82f6"
              strokeWidth={bboxMetrics.bboxStroke}
              pointerEvents="none"
            />
            <circle
              className="logo-rotate-handle"
              cx={0}
              cy={-bboxMetrics.halfH - bboxMetrics.rotOffset}
              r={bboxMetrics.rotRadius}
              fill="white"
              stroke="#3b82f6"
              strokeWidth={bboxMetrics.bboxStroke}
              style={{ cursor: 'grab' }}
            />
            <path
              d={`M ${-bboxMetrics.rotRadius * 0.45} ${-bboxMetrics.halfH - bboxMetrics.rotOffset - bboxMetrics.rotRadius * 0.35} A ${bboxMetrics.rotRadius * 0.5} ${bboxMetrics.rotRadius * 0.5} 0 1 1 ${bboxMetrics.rotRadius * 0.35} ${-bboxMetrics.halfH - bboxMetrics.rotOffset + bboxMetrics.rotRadius * 0.45}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={bboxMetrics.bboxStroke * 0.8}
              strokeLinecap="round"
              pointerEvents="none"
            />
            <path
              d={`M ${bboxMetrics.rotRadius * 0.35} ${-bboxMetrics.halfH - bboxMetrics.rotOffset + bboxMetrics.rotRadius * 0.45} L ${bboxMetrics.rotRadius * 0.55} ${-bboxMetrics.halfH - bboxMetrics.rotOffset + bboxMetrics.rotRadius * 0.15} L ${bboxMetrics.rotRadius * 0.1} ${-bboxMetrics.halfH - bboxMetrics.rotOffset + bboxMetrics.rotRadius * 0.35}`}
              fill="#3b82f6"
              stroke="none"
              pointerEvents="none"
            />
          </g>
        )}
      </svg>
    )
  }
)

PatternViewer.displayName = 'PatternViewer'

export default PatternViewer
