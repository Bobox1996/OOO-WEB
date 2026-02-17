'use client'

import React, { forwardRef, useMemo } from 'react'
import {
  computeMetaballIsocurves,
  Point2D,
} from '@/lib/utils/metaball.utils'

export interface MetaballViewerProps {
  charges: Point2D[]
  passThroughPoints: Point2D[]
  accuracy: number | null
  strokeWeight: number
  strokeColor: string
  /** Index of isocurve set to fill (-1 = none). Sets are sorted by area. */
  fillSetIndex: number
  /** Color to fill the selected set with */
  fillColor: string
}

const MetaballViewer = forwardRef<SVGSVGElement, MetaballViewerProps>(
  ({ charges, passThroughPoints, accuracy, strokeWeight, strokeColor, fillSetIndex, fillColor }, ref) => {
    const result = useMemo(
      () => computeMetaballIsocurves(charges, passThroughPoints, accuracy),
      [charges, passThroughPoints, accuracy],
    )

    // Compute viewBox from all polyline points across all sets
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

    return (
      <svg
        ref={ref}
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* White background */}
        <rect
          x={viewBox.minX}
          y={viewBox.minY}
          width={viewBox.width}
          height={viewBox.height}
          fill="white"
        />

        {/* Fill layer (bottom) */}
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

        {/* Stroke layer (top) */}
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
      </svg>
    )
  },
)

MetaballViewer.displayName = 'MetaballViewer'

export default MetaballViewer
