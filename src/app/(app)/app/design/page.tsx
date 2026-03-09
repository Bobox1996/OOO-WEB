'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppNav from '@/components/layout/AppNav'
import PatternViewer from '@/components/sections/PatternViewer'
import MetaballViewer from '@/components/sections/MetaballViewer'
import AsawaViewer, { AsawaLogoOverlay } from '@/components/sections/AsawaViewer'
import PixelizerViewer, { PixelizerLogoOverlay, PixelInfo } from '@/components/sections/PixelizerViewer'
import { generatePoints } from '@/lib/utils/metaball.utils'
import { parseSvg } from '@/components/sections/LogoImport'
import { createClient } from '@/services/supabase/client'

const PATTERN_DEFAULTS = {
  columns: 7,
  rows: 5,
  strokeWeight: 0.3,
  strokeColor: '#000000',
  slogan: 'BA      SAN JOSEBREAD   HAS     A LIFE',
  sloganFont: 'var(--font-zilla-slab), "Zilla Slab", serif',
  sloganWeight: 800,
  sloganColor: '#000000',
  rotationRandom: 20,
  positionRandom: 0.2,
  randomSeed: 0,
}

const ASAWA_DEFAULTS = {
  columns: 25,
  rows: 25,
  strokeWeight: 0.3,
  strokeColor: 'transparent',
  rotationRandom: 3,
  positionRandom: 0.23,
  randomSeed: 0,
}

const ASAWA_CELL_SIZE = 12

const PIXELIZER_DEFAULTS = {
  resolution: 2500,
  cellSize: 12,
  defaultImage: '/defaults/pixel-maker-default.png',
}

function computeCoverGrid(totalPixels: number, aspectRatio: number) {
  const cols = Math.round(Math.sqrt(totalPixels * aspectRatio))
  const rows = Math.round(totalPixels / cols)
  return { cols: Math.max(1, cols), rows: Math.max(1, rows) }
}

function extractCoverPixelData(image: HTMLImageElement, cols: number, rows: number): PixelInfo[][] {
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

const METABALL_DEFAULTS = {
  totalPoints: 60,
  chargeCount: 40,
  seed: 5,
  accuracy: 0.02,
  strokeWeight: 0.01,
  strokeColor: '#000000',
  fillSetIndex: -1,
  fillColor: '#F0EEE9',
}

export default function SelectDesignerPage() {
  const router = useRouter()
  const supabase = createClient()

  const { charges, passThroughPoints } = useMemo(
    () => generatePoints(METABALL_DEFAULTS.totalPoints, METABALL_DEFAULTS.chargeCount, METABALL_DEFAULTS.seed),
    [],
  )

  const [asawaCoverLogo, setAsawaCoverLogo] = useState<AsawaLogoOverlay | null>(null)
  const [pixelizerCoverData, setPixelizerCoverData] = useState<{ pixelData: PixelInfo[][]; cols: number; rows: number } | null>(null)
  const [pixelizerCoverLogo, setPixelizerCoverLogo] = useState<PixelizerLogoOverlay | null>(null)

  useEffect(() => {
    const fetchCoverLogo = async () => {
      const { data } = await supabase
        .from('app_user_logos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
      if (data && data.length > 0) {
        try {
          const response = await fetch(data[0].image_url)
          const svgText = await response.text()
          const { innerContent, width, height, minX, minY, defaultFill, defaultStroke, defaultStrokeWidth } = parseSvg(svgText)
          if (innerContent) {
            setAsawaCoverLogo({
              svgContent: innerContent,
              fillColor: defaultFill,
              strokeColor: defaultStroke,
              strokeWidth: defaultStrokeWidth,
              nativeWidth: width,
              nativeHeight: height,
              nativeMinX: minX,
              nativeMinY: minY,
            })
            setPixelizerCoverLogo({
              svgContent: innerContent,
              strokeColor: defaultStroke,
              strokeWidth: defaultStrokeWidth,
              nativeWidth: width,
              nativeHeight: height,
              nativeMinX: minX,
              nativeMinY: minY,
            })
          }
        } catch (err) {
          console.error('Failed to fetch cover logo:', err)
        }
      }
    }
    fetchCoverLogo()
  }, [supabase])

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const ar = img.naturalWidth / img.naturalHeight
      const { cols, rows } = computeCoverGrid(PIXELIZER_DEFAULTS.resolution, ar)
      const pixelData = extractCoverPixelData(img, cols, rows)
      setPixelizerCoverData({ pixelData, cols, rows })
    }
    img.src = PIXELIZER_DEFAULTS.defaultImage
  }, [])

  const designers = [
    {
      id: 'pattern',
      name: 'Jitter Lattice',
      description: 'Create parametric SVG grid patterns with customizable parameters',
      href: '/app/pattern',
      available: true,
    },
    {
      id: 'metaball',
      name: 'Metaball Isocurve',
      description: 'Generate 2D metaball isocurves through points with marching squares',
      href: '/app/metaball',
      available: true,
    },
    {
      id: 'ruth-asawa',
      name: 'Ruth Asawa',
      description: 'Generate wire-inspired grid patterns with adjustable density',
      href: '/app/ruth-asawa',
      available: true,
    },
    {
      id: 'pixelizer',
      name: 'Pixel Maker',
      description: 'Upload an image and pixelize it using your logo as tiles',
      href: '/app/pixelizer',
      available: true,
    },
    {
      id: 'color-themer',
      name: 'Color Themer',
      description: 'Upload an image and let AI extract a color palette from it',
      href: '/app/color-themer',
      available: true,
    },
  ]

  return (
    <>
      <AppNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              Select
              <br />
              Design Model
            </h1>
            <p className="text-neutral-500 mt-4 text-lg">
              Choose a design model to create patterns for AI generation
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-sm font-medium">
                1
              </span>
              <span className="text-sm uppercase tracking-wider font-medium">Select Design Model</span>
            </div>
            <div className="h-px bg-neutral-300 flex-1 max-w-24" />
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-400 flex items-center justify-center text-sm font-medium">
                2
              </span>
              <span className="text-sm uppercase tracking-wider text-neutral-400">Create Pattern</span>
            </div>
            <div className="h-px bg-neutral-300 flex-1 max-w-24" />
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-400 flex items-center justify-center text-sm font-medium">
                3
              </span>
              <span className="text-sm uppercase tracking-wider text-neutral-400">AI Generate</span>
            </div>
          </div>

          {/* Designer Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {designers.map((designer) => (
              <button
                key={designer.id}
                onClick={() => designer.available && router.push(designer.href)}
                disabled={!designer.available}
                className={`group text-left border transition-all ${
                  designer.available
                    ? 'border-black/10 hover:border-black cursor-pointer'
                    : 'border-dashed border-neutral-300 cursor-not-allowed opacity-60'
                }`}
              >
                {/* Preview Area */}
                <div
                  className={`aspect-square w-full overflow-hidden pointer-events-none ${
                    designer.available ? 'bg-white' : 'bg-neutral-50'
                  }`}
                >
                  {designer.id === 'pattern' ? (
                    <PatternViewer
                      columns={PATTERN_DEFAULTS.columns}
                      rows={PATTERN_DEFAULTS.rows}
                      strokeWeight={PATTERN_DEFAULTS.strokeWeight}
                      strokeColor={PATTERN_DEFAULTS.strokeColor}
                      slogan={PATTERN_DEFAULTS.slogan}
                      sloganFont={PATTERN_DEFAULTS.sloganFont}
                      sloganWeight={PATTERN_DEFAULTS.sloganWeight}
                      sloganColor={PATTERN_DEFAULTS.sloganColor}
                      rotationRandom={PATTERN_DEFAULTS.rotationRandom}
                      positionRandom={PATTERN_DEFAULTS.positionRandom}
                      randomSeed={PATTERN_DEFAULTS.randomSeed}
                    />
                  ) : designer.id === 'metaball' ? (
                    <MetaballViewer
                      charges={charges}
                      passThroughPoints={passThroughPoints}
                      accuracy={METABALL_DEFAULTS.accuracy}
                      strokeWeight={METABALL_DEFAULTS.strokeWeight}
                      strokeColor={METABALL_DEFAULTS.strokeColor}
                      fillSetIndex={METABALL_DEFAULTS.fillSetIndex}
                      fillColor={METABALL_DEFAULTS.fillColor}
                    />
                  ) : designer.id === 'ruth-asawa' ? (
                    <AsawaViewer
                      columns={ASAWA_DEFAULTS.columns}
                      rows={ASAWA_DEFAULTS.rows}
                      strokeWeight={ASAWA_DEFAULTS.strokeWeight}
                      strokeColor={ASAWA_DEFAULTS.strokeColor}
                      cellSize={ASAWA_CELL_SIZE}
                      rotationRandom={ASAWA_DEFAULTS.rotationRandom}
                      positionRandom={ASAWA_DEFAULTS.positionRandom}
                      randomSeed={ASAWA_DEFAULTS.randomSeed}
                      logoOverlay={asawaCoverLogo}
                      fillOpacityRandom={true}
                    />
                  ) : designer.id === 'pixelizer' && pixelizerCoverData ? (
                    <PixelizerViewer
                      cols={pixelizerCoverData.cols}
                      rows={pixelizerCoverData.rows}
                      cellSize={PIXELIZER_DEFAULTS.cellSize}
                      pixelData={pixelizerCoverData.pixelData}
                      logoOverlay={pixelizerCoverLogo}
                    />
                  ) : designer.id === 'color-themer' ? (
                    <div className="w-full h-full flex flex-col">
                      {['#303B41', '#1A241D', '#374F38', '#C8DADE', '#90A5A8'].map((c) => (
                        <div key={c} className="flex-1" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-neutral-300">
                      <svg
                        className="w-16 h-16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Card Info */}
                <div className="p-5 border-t border-black/10">
                  <h3 className="text-sm uppercase tracking-wider font-medium mb-1">
                    {designer.name}
                  </h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    {designer.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
