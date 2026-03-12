'use client'

import React, { forwardRef, useMemo } from 'react'

export interface PixelInfo {
  r: number
  g: number
  b: number
  alpha: number
}

export interface PixelizerLogoOverlay {
  svgContent: string
  strokeColor: string
  strokeWidth: number
  nativeWidth: number
  nativeHeight: number
  nativeMinX: number
  nativeMinY: number
}

export interface PixelizerViewerProps {
  cols: number
  rows: number
  cellSize?: number
  pixelData: PixelInfo[][]
  logoOverlay?: PixelizerLogoOverlay | null
}

const SHAPE_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'text', 'tspan'])
const SKIP_TAGS = new Set(['defs', 'clippath', 'mask', 'pattern', 'lineargradient', 'radialgradient', 'stop', 'style', 'title', 'desc', 'metadata', 'symbol', 'filter'])

function prepareLogoForCurrentColor(svgContent: string, strokeColor: string, strokeWidth: number): string {
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
      el.setAttribute('fill', 'currentColor')
    } else if (!curFill && SHAPE_TAGS.has(tag)) {
      el.setAttribute('fill', 'currentColor')
    }

    if (strokeColor !== 'none') {
      const curStroke = el.getAttribute('stroke')
      if (curStroke && curStroke !== 'none' && curStroke !== 'transparent') {
        el.setAttribute('stroke', strokeColor)
      }
    }

    if (el.hasAttribute('stroke-width')) {
      el.setAttribute('stroke-width', String(strokeWidth))
    } else if (el.hasAttribute('stroke') && el.getAttribute('stroke') !== 'none') {
      el.setAttribute('stroke-width', String(strokeWidth))
    }

    const style = el.getAttribute('style')
    if (style) {
      let s = style
      s = s.replace(/fill\s*:\s*(?!none|transparent)[^;}"']+/gi, 'fill:currentColor')
      if (strokeColor !== 'none') {
        s = s.replace(/stroke\s*:\s*(?!none|transparent)[^;}"']+/gi, `stroke:${strokeColor}`)
      }
      s = s.replace(/stroke-width\s*:\s*[^;}"']+/gi, `stroke-width:${strokeWidth}`)
      el.setAttribute('style', s)
    }
  }

  const styleEls = svg.querySelectorAll('style')
  for (const styleEl of styleEls) {
    let css = styleEl.textContent || ''
    css = css.replace(/fill\s*:\s*(?!none|transparent)[^;}"']+/gi, 'fill:currentColor')
    if (strokeColor !== 'none') {
      css = css.replace(/stroke\s*:\s*(?!none|transparent)[^;}"']+/gi, `stroke:${strokeColor}`)
    }
    css = css.replace(/stroke-width\s*:\s*[^;}"']+/gi, `stroke-width:${strokeWidth}`)
    styleEl.textContent = css
  }

  return svg.innerHTML
}

const PixelizerViewer = forwardRef<SVGSVGElement, PixelizerViewerProps>(
  ({ cols, rows, cellSize = 12, pixelData, logoOverlay }, ref) => {
    const gridWidth = cols * cellSize
    const gridHeight = rows * cellSize

    const preparedContent = useMemo(() => {
      if (!logoOverlay) return ''
      return prepareLogoForCurrentColor(logoOverlay.svgContent, logoOverlay.strokeColor, logoOverlay.strokeWidth)
    }, [logoOverlay?.svgContent, logoOverlay?.strokeColor, logoOverlay?.strokeWidth])

    const logoScale = useMemo(() => {
      if (!logoOverlay) return 1
      return cellSize / Math.max(logoOverlay.nativeWidth, logoOverlay.nativeHeight)
    }, [logoOverlay?.nativeWidth, logoOverlay?.nativeHeight, cellSize])

    const logoElements = useMemo(() => {
      if (!logoOverlay || pixelData.length === 0) return null
      const elements: React.ReactNode[] = []

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const pixel = pixelData[row]?.[col] ?? { r: 200, g: 200, b: 200, alpha: 255 }
          if (pixel.alpha === 0) continue

          const color = `rgb(${pixel.r},${pixel.g},${pixel.b})`
          const x = col * cellSize + cellSize / 2
          const y = row * cellSize + cellSize / 2

          elements.push(
            <use
              key={`px-${row}-${col}`}
              href="#pixelizer-logo"
              transform={`translate(${x}, ${y}) scale(${logoScale})`}
              color={color}
              {...(pixel.alpha < 255 ? { opacity: pixel.alpha / 255 } : {})}
            />
          )
        }
      }
      return elements
    }, [rows, cols, cellSize, logoScale, logoOverlay, pixelData])

    const placeholderCells = useMemo(() => {
      if (logoOverlay || pixelData.length === 0) return null
      const rects: React.ReactNode[] = []
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const pixel = pixelData[row]?.[col] ?? { r: 200, g: 200, b: 200, alpha: 255 }
          if (pixel.alpha === 0) continue

          rects.push(
            <rect
              key={`cell-${row}-${col}`}
              x={col * cellSize}
              y={row * cellSize}
              width={cellSize}
              height={cellSize}
              fill={`rgb(${pixel.r},${pixel.g},${pixel.b})`}
              {...(pixel.alpha < 255 ? { opacity: pixel.alpha / 255 } : {})}
            />
          )
        }
      }
      return rects
    }, [logoOverlay, pixelData, rows, cols, cellSize])

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${gridWidth} ${gridHeight}`}
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        overflow="visible"
      >
        {logoOverlay && (
          <defs>
            <g
              id="pixelizer-logo"
              transform={`translate(${-logoOverlay.nativeMinX - logoOverlay.nativeWidth / 2}, ${-logoOverlay.nativeMinY - logoOverlay.nativeHeight / 2})`}
              dangerouslySetInnerHTML={{ __html: preparedContent }}
            />
          </defs>
        )}
        <rect x={0} y={0} width={gridWidth} height={gridHeight} fill="white" />
        {logoElements}
        {placeholderCells}
      </svg>
    )
  }
)

PixelizerViewer.displayName = 'PixelizerViewer'

export default PixelizerViewer
