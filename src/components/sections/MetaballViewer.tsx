'use client'

import React, { forwardRef, useMemo } from 'react'
import {
  computeMetaballIsocurves,
  Point2D,
} from '@/lib/utils/metaball.utils'

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

export interface MetaballViewerProps {
  charges: Point2D[]
  passThroughPoints: Point2D[]
  accuracy: number | null
  strokeWeight: number
  strokeColor: string
  fillSetIndex: number
  fillColor: string
  logoOverlay?: LogoOverlayData | null
  logoSelected?: boolean
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

const MetaballViewer = forwardRef<SVGSVGElement, MetaballViewerProps>(
  ({ charges, passThroughPoints, accuracy, strokeWeight, strokeColor, fillSetIndex, fillColor, logoOverlay, logoSelected }, ref) => {
    const result = useMemo(
      () => computeMetaballIsocurves(charges, passThroughPoints, accuracy),
      [charges, passThroughPoints, accuracy],
    )

    const viewBox = useMemo(() => {
      const allPts = result.sets.flatMap((s) => s.polylines.flat())
      if (allPts.length === 0) {
        return { minX: -1, minY: -1, width: 12, height: 12 }
      }
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const p of allPts) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
      const pad = Math.max(maxX - minX, maxY - minY) * 0.1 || 1
      return {
        minX: minX - pad,
        minY: minY - pad,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2,
      }
    }, [result.sets])

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
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x={viewBox.minX}
          y={viewBox.minY}
          width={viewBox.width}
          height={viewBox.height}
          fill="white"
        />

        {fillSetIndex >= 0 && fillSetIndex < result.sets.length &&
          result.sets[fillSetIndex].pathData.map((d, pathIdx) => (
            <path
              key={`fill-${pathIdx}`}
              d={d}
              fill={fillColor}
              stroke="none"
            />
          ))
        }

        {result.sets.map((set, setIdx) =>
          set.pathData.map((d, pathIdx) => (
            <path
              key={`${setIdx}-${pathIdx}`}
              d={d}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWeight}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))
        )}

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
  },
)

MetaballViewer.displayName = 'MetaballViewer'

export default MetaballViewer
