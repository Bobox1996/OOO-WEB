'use client'

import React, { forwardRef, useMemo } from 'react'

export interface AsawaLogoOverlay {
  svgContent: string
  fillColor: string
  strokeColor: string
  strokeWidth: number
  nativeWidth: number
  nativeHeight: number
  nativeMinX: number
  nativeMinY: number
}

export interface AsawaViewerProps {
  columns: number
  rows: number
  strokeWeight: number
  strokeColor: string
  cellSize?: number
  logoOverlay?: AsawaLogoOverlay | null
  rotationRandom?: number
  positionRandom?: number
  randomSeed?: number
  fillOpacityRandom?: boolean
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function catmullRom(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

const ANCHOR_INTERVAL = 6

function generateColumnOffsets(
  col: number,
  totalRows: number,
  amplitude: number,
  cellSize: number,
  seed: number,
): Array<{ dx: number; dy: number }> {
  const vertexCount = totalRows + 1
  const anchorCount = Math.ceil(vertexCount / ANCHOR_INTERVAL) + 1
  const totalAnchors = anchorCount + 2

  const anchorsX: number[] = []
  const anchorsY: number[] = []
  for (let i = 0; i < totalAnchors; i++) {
    const s = col * 7919 + (i - 1) * 6271 + seed * 13397
    anchorsX.push((seededRandom(s) * 2 - 1) * amplitude * cellSize)
    anchorsY.push((seededRandom(s + 3571) * 2 - 1) * amplitude * cellSize)
  }

  const offsets: Array<{ dx: number; dy: number }> = []
  for (let row = 0; row < vertexCount; row++) {
    const segFloat = row / ANCHOR_INTERVAL
    const seg = Math.floor(segFloat)
    const t = segFloat - seg
    const i0 = seg
    const i1 = seg + 1
    const i2 = Math.min(seg + 2, totalAnchors - 1)
    const i3 = Math.min(seg + 3, totalAnchors - 1)
    offsets.push({
      dx: catmullRom(t, anchorsX[i0], anchorsX[i1], anchorsX[i2], anchorsX[i3]),
      dy: catmullRom(t, anchorsY[i0], anchorsY[i1], anchorsY[i2], anchorsY[i3]),
    })
  }
  return offsets
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

  const styleEls = svg.querySelectorAll('style')
  for (const styleEl of styleEls) {
    let css = styleEl.textContent || ''
    css = css.replace(/fill\s*:\s*(?!none|transparent)[^;}"']+/gi, `fill:${fillColor}`)
    if (strokeColor !== 'none') {
      css = css.replace(/stroke\s*:\s*(?!none|transparent)[^;}"']+/gi, `stroke:${strokeColor}`)
    }
    css = css.replace(/stroke-width\s*:\s*[^;}"']+/gi, `stroke-width:${sw}`)
    styleEl.textContent = css
  }

  return svg.innerHTML
}

const AsawaViewer = forwardRef<SVGSVGElement, AsawaViewerProps>(
  ({ columns, rows, strokeWeight, strokeColor, cellSize = 12, logoOverlay, rotationRandom = 0, positionRandom = 0, randomSeed = 0, fillOpacityRandom = false }, ref) => {
    const gridWidth = columns * cellSize
    const gridHeight = rows * cellSize
    const padding = cellSize / 2

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

    const recoloredContent = useMemo(() => {
      if (!logoOverlay) return ''
      return recolorSvg(logoOverlay.svgContent, logoOverlay.fillColor, logoOverlay.strokeColor, logoOverlay.strokeWidth)
    }, [logoOverlay?.svgContent, logoOverlay?.fillColor, logoOverlay?.strokeColor, logoOverlay?.strokeWidth])

    const logoScale = useMemo(() => {
      if (!logoOverlay) return 1
      return cellSize / Math.max(logoOverlay.nativeWidth, logoOverlay.nativeHeight)
    }, [logoOverlay?.nativeWidth, logoOverlay?.nativeHeight, cellSize])

    const columnOffsets = useMemo(() => {
      if (!logoOverlay || positionRandom <= 0) return null
      const offsets: Array<Array<{ dx: number; dy: number }>> = []
      for (let col = 0; col <= columns; col++) {
        offsets.push(generateColumnOffsets(col, rows, positionRandom, cellSize, randomSeed))
      }
      return offsets
    }, [logoOverlay, columns, rows, positionRandom, cellSize, randomSeed])

    const logoUses = useMemo(() => {
      if (!logoOverlay) return null
      const elements: React.ReactNode[] = []
      for (let row = 0; row <= rows; row++) {
        for (let col = 0; col <= columns; col++) {
          const baseX = col * cellSize
          const baseY = row * cellSize

          const offset = columnOffsets?.[col]?.[row]
          const dx = offset?.dx ?? 0
          const dy = offset?.dy ?? 0

          let angle = 0
          if (rotationRandom > 0) {
            const rotSeed = row * 1000 + col + randomSeed * 13397
            angle = (seededRandom(rotSeed) * 2 - 1) * rotationRandom
          }

          const x = baseX + dx
          const y = baseY + dy

          let opacity: number | undefined
          if (fillOpacityRandom) {
            const opSeed = row * 1000 + col + 5003 + randomSeed * 7727
            opacity = 1 - seededRandom(opSeed) * 0.6
          }

          elements.push(
            <use
              key={`logo-${row}-${col}`}
              href="#asawa-logo"
              transform={`translate(${x}, ${y}) rotate(${angle}) scale(${logoScale})`}
              {...(opacity !== undefined ? { opacity } : {})}
            />
          )
        }
      }
      return elements
    }, [rows, columns, cellSize, logoScale, logoOverlay, columnOffsets, rotationRandom, randomSeed, fillOpacityRandom])

    return (
      <svg
        ref={ref}
        viewBox={`${-padding} ${-padding} ${gridWidth + padding * 2} ${gridHeight + padding * 2}`}
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        overflow="visible"
      >
        {logoOverlay && (
          <defs>
            <g
              id="asawa-logo"
              transform={`translate(${(-logoOverlay.nativeMinX - logoOverlay.nativeWidth / 2)}, ${(-logoOverlay.nativeMinY - logoOverlay.nativeHeight / 2)})`}
              dangerouslySetInnerHTML={{ __html: recoloredContent }}
            />
          </defs>
        )}
        <rect
          x={-padding}
          y={-padding}
          width={gridWidth + padding * 2}
          height={gridHeight + padding * 2}
          fill="white"
        />
        {verticalLines}
        {horizontalLines}
        {logoUses}
      </svg>
    )
  }
)

AsawaViewer.displayName = 'AsawaViewer'

export default AsawaViewer
