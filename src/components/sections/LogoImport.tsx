'use client'

import { useState, useRef, useEffect } from 'react'
import { AppUserLogo } from '@/types'

export interface LogoOverlay {
  svgContent: string
  url: string
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

interface LogoImportProps {
  logos: AppUserLogo[]
  logoOverlay: LogoOverlay | null
  onLogoOverlayChange: (overlay: LogoOverlay | null) => void
  viewerDimensions: { width: number; height: number }
  fillOpacityRandom?: boolean
  onFillOpacityRandomChange?: (value: boolean) => void
  hideFillColor?: boolean
}

export function parseSvg(svgText: string): {
  innerContent: string; width: number; height: number;
  minX: number; minY: number;
  defaultFill: string; defaultStroke: string; defaultStrokeWidth: number;
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const svgEl = doc.querySelector('svg')

  let width = 100
  let height = 100
  let minX = 0
  let minY = 0
  let defaultFill = '#000000'
  let defaultStroke = 'none'
  let defaultStrokeWidth = 0

  if (svgEl) {
    const vb = svgEl.getAttribute('viewBox')
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/)
      if (parts.length === 4) {
        minX = parseFloat(parts[0]) || 0
        minY = parseFloat(parts[1]) || 0
        width = parseFloat(parts[2]) || 100
        height = parseFloat(parts[3]) || 100
      }
    } else {
      width = parseFloat(svgEl.getAttribute('width') || '100')
      height = parseFloat(svgEl.getAttribute('height') || '100')
    }

    const allEls = svgEl.querySelectorAll('*')
    let foundFill = false
    let foundStroke = false
    let foundStrokeWidth = false

    for (const el of allEls) {
      if (!foundFill) {
        const f = el.getAttribute('fill')
        if (f && f !== 'none' && f !== 'transparent') {
          defaultFill = f
          foundFill = true
        }
      }
      if (!foundStroke) {
        const s = el.getAttribute('stroke')
        if (s && s !== 'none' && s !== 'transparent') {
          defaultStroke = s
          foundStroke = true
        }
      }
      if (!foundStrokeWidth) {
        const sw = el.getAttribute('stroke-width')
        if (sw) {
          defaultStrokeWidth = parseFloat(sw) || 0
          foundStrokeWidth = true
        }
      }
      if (foundFill && foundStroke && foundStrokeWidth) break
    }

    return { innerContent: svgEl.innerHTML, width, height, minX, minY, defaultFill, defaultStroke, defaultStrokeWidth }
  }

  return { innerContent: '', width, height, minX, minY, defaultFill, defaultStroke, defaultStrokeWidth }
}

export default function LogoImport({
  logos,
  logoOverlay,
  onLogoOverlayChange,
  viewerDimensions,
  fillOpacityRandom,
  onFillOpacityRandomChange,
  hideFillColor,
}: LogoImportProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectLogo = async (logo: AppUserLogo) => {
    setLoading(true)
    setDropdownOpen(false)

    try {
      const response = await fetch(logo.image_url)
      const svgText = await response.text()
      const { innerContent, width, height, minX, minY, defaultFill, defaultStroke, defaultStrokeWidth } = parseSvg(svgText)

      if (!innerContent) {
        setLoading(false)
        return
      }

      const targetSize = Math.min(viewerDimensions.width, viewerDimensions.height) / 6
      const logoMaxDim = Math.max(width, height)
      const initialScale = targetSize / logoMaxDim

      onLogoOverlayChange({
        svgContent: innerContent,
        url: logo.image_url,
        x: viewerDimensions.width / 2,
        y: viewerDimensions.height / 2,
        scale: initialScale,
        rotation: 0,
        fillColor: defaultFill,
        strokeColor: defaultStroke,
        strokeWidth: defaultStrokeWidth,
        nativeWidth: width,
        nativeHeight: height,
        nativeMinX: minX,
        nativeMinY: minY,
      })
    } catch (err) {
      console.error('Failed to fetch logo SVG:', err)
    }

    setLoading(false)
  }

  const handleRemove = () => {
    onLogoOverlayChange(null)
  }

  return (
    <div className="border-t border-black/10 pt-6">
      <p className="text-sm uppercase tracking-wider text-neutral-500 mb-4">
        Logo Overlay
      </p>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={loading || logos.length === 0}
            className="px-4 py-2.5 text-xs uppercase tracking-wider border border-black/20 hover:bg-neutral-100 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {loading ? 'Loading...' : 'Import Logo'}
          </button>

          {dropdownOpen && logos.length > 0 && (
            <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-black/10 shadow-lg z-50 max-h-48 overflow-y-auto">
              {logos.map((logo) => (
                <button
                  key={logo.id}
                  onClick={() => handleSelectLogo(logo)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 transition-colors text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo.image_url}
                    alt={logo.filename}
                    className="w-8 h-8 object-contain flex-shrink-0"
                  />
                  <span className="text-xs text-neutral-700 truncate">{logo.filename}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {logos.length === 0 && (
        <p className="text-xs text-neutral-400">
          No logos uploaded. Upload SVG logos from the Dashboard.
        </p>
      )}

      {logoOverlay && (
        <div className="space-y-4">
          <div className={`grid ${hideFillColor ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
            {!hideFillColor && (
              <div>
                <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">Fill</label>
                <input
                  type="color"
                  value={logoOverlay.fillColor}
                  onChange={(e) => onLogoOverlayChange({ ...logoOverlay, fillColor: e.target.value })}
                  className="w-full h-9 border border-black/20 cursor-pointer bg-white p-0.5"
                  title="Fill color"
                />
              </div>
            )}
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">Stroke</label>
              <input
                type="color"
                value={logoOverlay.strokeColor === 'none' ? '#000000' : logoOverlay.strokeColor}
                onChange={(e) => onLogoOverlayChange({ ...logoOverlay, strokeColor: e.target.value })}
                className="w-full h-9 border border-black/20 cursor-pointer bg-white p-0.5"
                title="Stroke color"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">Stroke Width</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={10}
                step={0.1}
                value={logoOverlay.strokeWidth}
                onChange={(e) => onLogoOverlayChange({ ...logoOverlay, strokeWidth: parseFloat(e.target.value) })}
                className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
              />
              <span className="text-xs text-neutral-600 w-10 text-right">{logoOverlay.strokeWidth.toFixed(1)}</span>
            </div>
          </div>

          {onFillOpacityRandomChange && (
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider text-neutral-500">Random Fill Opacity</label>
              <button
                type="button"
                role="switch"
                aria-checked={fillOpacityRandom}
                onClick={() => onFillOpacityRandomChange(!fillOpacityRandom)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${fillOpacityRandom ? 'bg-black' : 'bg-neutral-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${fillOpacityRandom ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          )}

          <p className="text-xs text-neutral-400">
            Click the logo in the viewer to select it. Drag to move, drag corners to scale, use the rotation handle to rotate.
          </p>

          <button
            onClick={handleRemove}
            className="w-full py-2 text-xs uppercase tracking-wider border border-red-300 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
          >
            Remove Logo
          </button>
        </div>
      )}
    </div>
  )
}
