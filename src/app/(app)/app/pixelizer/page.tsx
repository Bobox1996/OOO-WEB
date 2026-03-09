'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AppNav from '@/components/layout/AppNav'
import PixelizerViewer, { PixelInfo } from '@/components/sections/PixelizerViewer'
import PixelizerControls, { PixelizerParams } from '@/components/sections/PixelizerControls'
import ViewerContainer from '@/components/sections/ViewerContainer'
import LogoImport, { LogoOverlay, parseSvg } from '@/components/sections/LogoImport'
import { createClient } from '@/services/supabase/client'
import { AppUserLogo, AppPixelizerPattern } from '@/types'

const CELL_SIZE = 12

function computeGrid(totalPixels: number, aspectRatio: number) {
  const cols = Math.round(Math.sqrt(totalPixels * aspectRatio))
  const rows = Math.round(totalPixels / cols)
  return { cols: Math.max(1, cols), rows: Math.max(1, rows) }
}

function extractPixelData(
  image: HTMLImageElement,
  cols: number,
  rows: number,
): PixelInfo[][] {
  const canvas = document.createElement('canvas')
  canvas.width = cols
  canvas.height = rows
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  ctx.drawImage(image, 0, 0, cols, rows)
  const imageData = ctx.getImageData(0, 0, cols, rows)
  const data = imageData.data

  const pixels: PixelInfo[][] = []
  for (let row = 0; row < rows; row++) {
    const rowData: PixelInfo[] = []
    for (let col = 0; col < cols; col++) {
      const i = (row * cols + col) * 4
      rowData.push({ r: data[i], g: data[i + 1], b: data[i + 2], alpha: data[i + 3] })
    }
    pixels.push(rowData)
  }
  return pixels
}

export default function PixelizerPage() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const supabase = createClient()
  const imageRef = useRef<HTMLImageElement | null>(null)

  const [params, setParams] = useState<PixelizerParams>({ resolution: 2500 })
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [aspectRatio, setAspectRatio] = useState(1)
  const [pixelData, setPixelData] = useState<PixelInfo[][]>([])

  const [logos, setLogos] = useState<AppUserLogo[]>([])
  const [logoOverlay, setLogoOverlay] = useState<LogoOverlay | null>(null)
  const autoImportedRef = useRef(false)
  const [recentPatterns, setRecentPatterns] = useState<AppPixelizerPattern[]>([])
  const [patternsLoading, setPatternsLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const { cols, rows } = useMemo(
    () => computeGrid(params.resolution, aspectRatio),
    [params.resolution, aspectRatio],
  )

  const recomputePixels = useCallback((img: HTMLImageElement, c: number, r: number) => {
    const data = extractPixelData(img, c, r)
    setPixelData(data)
  }, [])

  useEffect(() => {
    if (imageRef.current) {
      recomputePixels(imageRef.current, cols, rows)
    }
  }, [cols, rows, recomputePixels])

  const defaultImageLoadedRef = useRef(false)
  useEffect(() => {
    if (defaultImageLoadedRef.current) return
    defaultImageLoadedRef.current = true
    const img = new Image()
    img.onload = () => {
      setImagePreview('/defaults/pixel-maker-default.png')
      const ar = img.naturalWidth / img.naturalHeight
      setAspectRatio(ar)
      imageRef.current = img
      const { cols: c, rows: r } = computeGrid(2500, ar)
      setPixelData(extractPixelData(img, c, r))
    }
    img.src = '/defaults/pixel-maker-default.png'
  }, [])

  useEffect(() => {
    const fetchPatterns = async () => {
      setPatternsLoading(true)
      const { data: pinnedData } = await supabase
        .from('app_pixelizer_patterns')
        .select('*')
        .eq('pinned', true)
        .order('created_at', { ascending: false })

      const pinnedPatterns = pinnedData || []
      const remainingSlots = Math.max(0, 6 - pinnedPatterns.length)

      let recentNonPinned: AppPixelizerPattern[] = []
      if (remainingSlots > 0) {
        const { data: recentData } = await supabase
          .from('app_pixelizer_patterns')
          .select('*')
          .eq('pinned', false)
          .order('created_at', { ascending: false })
          .limit(remainingSlots)
        recentNonPinned = recentData || []
      }

      setRecentPatterns([...pinnedPatterns, ...recentNonPinned])
      setPatternsLoading(false)
    }

    const fetchLogos = async () => {
      const { data } = await supabase
        .from('app_user_logos')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) {
        setLogos(data)
        if (data.length > 0 && !autoImportedRef.current) {
          autoImportedRef.current = true
          try {
            const response = await fetch(data[0].image_url)
            const svgText = await response.text()
            const { innerContent, width, height, minX, minY, defaultFill, defaultStroke, defaultStrokeWidth } = parseSvg(svgText)
            if (innerContent) {
              const logoScale = CELL_SIZE / Math.max(width, height)
              setLogoOverlay({
                svgContent: innerContent,
                url: data[0].image_url,
                x: 0,
                y: 0,
                scale: logoScale,
                rotation: 0,
                fillColor: defaultFill,
                strokeColor: defaultStroke,
                strokeWidth: defaultStrokeWidth,
                nativeWidth: width,
                nativeHeight: height,
                nativeMinX: minX,
                nativeMinY: minY,
              })
            }
          } catch (err) {
            console.error('Failed to auto-import logo:', err)
          }
        }
      }
    }
    fetchPatterns()
    fetchLogos()
  }, [supabase])

  const handleParamChange = (newParams: Partial<PixelizerParams>) => {
    setParams((prev) => ({ ...prev, ...newParams }))
  }

  const handleImageUpload = useCallback((file: File) => {
    const url = URL.createObjectURL(file)
    setImagePreview(url)

    const img = new Image()
    img.onload = () => {
      const ar = img.naturalWidth / img.naturalHeight
      setAspectRatio(ar)
      imageRef.current = img
      const { cols: c, rows: r } = computeGrid(params.resolution, ar)
      const data = extractPixelData(img, c, r)
      setPixelData(data)
    }
    img.src = url
  }, [params.resolution])

  const handleImageRemove = useCallback(() => {
    setImagePreview(null)
    setPixelData([])
    imageRef.current = null
    setAspectRatio(1)
  }, [])

  const handleLogoOverlayChange = useCallback((overlay: LogoOverlay | null) => {
    if (overlay) {
      const logoScale = CELL_SIZE / Math.max(overlay.nativeWidth, overlay.nativeHeight)
      setLogoOverlay({ ...overlay, scale: logoScale })
    } else {
      setLogoOverlay(null)
    }
  }, [])

  const getViewerDimensions = useCallback(() => {
    return { width: cols * CELL_SIZE, height: rows * CELL_SIZE }
  }, [cols, rows])

  const handleNext = async () => {
    if (!svgRef.current) return
    setSaving(true)
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svgRef.current)
    const base64 = btoa(unescape(encodeURIComponent(svgString)))

    localStorage.setItem('patternSVG', base64)
    localStorage.setItem('patternSource', 'pixel-maker')

    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      const { data: existingPatterns } = await supabase
        .from('app_pixelizer_patterns')
        .select('id, pinned')
        .eq('pinned', false)
        .order('created_at', { ascending: false })

      if (existingPatterns && existingPatterns.length >= 6) {
        const patternsToDelete = existingPatterns.slice(5)
        for (const pattern of patternsToDelete) {
          await supabase.from('app_pixelizer_patterns').delete().eq('id', pattern.id)
        }
      }

      const { data: inserted } = await supabase.from('app_pixelizer_patterns').insert({
        user_id: userData.user.id,
        resolution: params.resolution,
        svg_preview: base64,
        pinned: false,
      }).select('id').single()

      if (inserted) {
        localStorage.setItem('currentPatternId', inserted.id)
      }
    }

    setSaving(false)
    router.push('/app/generate')
  }

  const handleBack = () => {
    router.push('/app/design')
  }

  const handleLoadPattern = (pattern: AppPixelizerPattern) => {
    setParams({ resolution: pattern.resolution })
  }

  const handleTogglePin = async (pattern: AppPixelizerPattern) => {
    const newPinned = !pattern.pinned
    await supabase
      .from('app_pixelizer_patterns')
      .update({ pinned: newPinned })
      .eq('id', pattern.id)
    setRecentPatterns((prev) =>
      prev.map((p) => (p.id === pattern.id ? { ...p, pinned: newPinned } : p))
    )
  }

  const handleDeletePattern = async (patternId: string) => {
    await supabase.from('app_pixelizer_patterns').delete().eq('id', patternId)
    setRecentPatterns((prev) => prev.filter((p) => p.id !== patternId))
  }

  return (
    <>
      <AppNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              Pixel
              <br />
              Maker
            </h1>
            <p className="text-neutral-500 mt-4 text-lg">
              Transform images into pixelized mosaics using your logo
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-400 flex items-center justify-center text-sm font-medium">1</span>
              <span className="text-sm uppercase tracking-wider text-neutral-400">Select Design Model</span>
            </div>
            <div className="h-px bg-neutral-300 flex-1 max-w-24" />
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-sm font-medium">2</span>
              <span className="text-sm uppercase tracking-wider font-medium">Create Pattern</span>
            </div>
            <div className="h-px bg-neutral-300 flex-1 max-w-24" />
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-400 flex items-center justify-center text-sm font-medium">3</span>
              <span className="text-sm uppercase tracking-wider text-neutral-400">AI Generate</span>
            </div>
          </div>

          {/* Two-column layout: Viewer + Parameters */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 mb-12">
            {/* Left: Sticky viewer */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="aspect-square bg-white border border-black/10 relative">
                {pixelData.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-neutral-300">
                    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">Upload an image to begin</p>
                  </div>
                ) : (
                  <ViewerContainer>
                    <PixelizerViewer
                      ref={svgRef}
                      cols={cols}
                      rows={rows}
                      cellSize={CELL_SIZE}
                      pixelData={pixelData}
                      logoOverlay={logoOverlay ? {
                        svgContent: logoOverlay.svgContent,
                        strokeColor: logoOverlay.strokeColor,
                        strokeWidth: logoOverlay.strokeWidth,
                        nativeWidth: logoOverlay.nativeWidth,
                        nativeHeight: logoOverlay.nativeHeight,
                        nativeMinX: logoOverlay.nativeMinX,
                        nativeMinY: logoOverlay.nativeMinY,
                      } : null}
                    />
                  </ViewerContainer>
                )}
              </div>
            </div>

            {/* Right: Scrollable parameters panel */}
            <div className="border border-black/10 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-black/10 px-5 py-3 z-10">
                <p className="text-sm uppercase tracking-wider font-medium">Parameters</p>
              </div>
              <div className="p-5 space-y-8">
                <PixelizerControls
                  resolution={params.resolution}
                  onChange={handleParamChange}
                  imagePreview={imagePreview}
                  onImageUpload={handleImageUpload}
                  onImageRemove={handleImageRemove}
                  cols={cols}
                  rows={rows}
                />

                <LogoImport
                  logos={logos}
                  logoOverlay={logoOverlay}
                  onLogoOverlayChange={handleLogoOverlayChange}
                  viewerDimensions={getViewerDimensions()}
                  hideFillColor
                />
              </div>
            </div>
          </div>

          {/* Recent Patterns */}
          <div className="mb-12">
            <p className="block text-sm uppercase tracking-wider text-neutral-500 mb-4">
              Recent Patterns
            </p>
            {patternsLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex-shrink-0 w-24 h-24 bg-neutral-200 animate-pulse" />
                ))}
              </div>
            ) : recentPatterns.length === 0 ? (
              <div className="bg-neutral-100 border border-black/10 p-8 text-center">
                <p className="text-neutral-500 text-sm">No saved patterns yet. Create one and click Next to save.</p>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {recentPatterns.map((pattern) => (
                  <div key={pattern.id} className="flex-shrink-0 w-24 h-24 relative group">
                    <button
                      onClick={() => handleLoadPattern(pattern)}
                      className="w-full h-full bg-white border border-black/10 overflow-hidden hover:border-black transition-colors"
                      title="Load this pattern"
                    >
                      <div
                        className="w-full h-full"
                        dangerouslySetInnerHTML={{
                          __html: decodeURIComponent(escape(atob(pattern.svg_preview))),
                        }}
                      />
                    </button>
                    <button
                      onClick={() => handleTogglePin(pattern)}
                      className={`absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        pattern.pinned
                          ? 'bg-black text-white'
                          : 'bg-white/80 text-neutral-400 opacity-0 group-hover:opacity-100'
                      }`}
                      title={pattern.pinned ? 'Unpin' : 'Pin'}
                    >
                      <svg className="w-3 h-3" fill={pattern.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                    {!pattern.pinned && (
                      <button
                        onClick={() => handleDeletePattern(pattern.id)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/80 text-neutral-400 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-4 border border-black/20 text-black text-sm uppercase tracking-widest font-medium hover:bg-neutral-100 transition-colors flex items-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={saving || pixelData.length === 0}
              className="px-8 py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  Next
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
