'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import AppNav from '@/components/layout/AppNav'
import { WaveParams, WaveLogoData, WAVE_DEFAULTS } from '@/components/sections/WavePatternViewer'
import WavePatternControls from '@/components/sections/WavePatternControls'
import LogoImport, { LogoOverlay } from '@/components/sections/LogoImport'
import { createClient } from '@/services/supabase/client'
import { AppUserLogo } from '@/types'

const WavePatternViewer = dynamic(
  () => import('@/components/sections/WavePatternViewer'),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-white" />,
  }
)

export default function WavePatternPage() {
  const router = useRouter()
  const supabase = createClient()

  const [params, setParams] = useState<WaveParams>({ ...WAVE_DEFAULTS })
  const [logos, setLogos] = useState<AppUserLogo[]>([])
  const [logoOverlay, setLogoOverlay] = useState<LogoOverlay | null>(null)

  useEffect(() => {
    const fetchLogos = async () => {
      const { data } = await supabase
        .from('app_user_logos')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setLogos(data)
    }
    fetchLogos()
  }, [supabase])

  const handleParamChange = useCallback((newParams: Partial<WaveParams>) => {
    setParams((prev) => ({ ...prev, ...newParams }))
  }, [])

  const handleLogoOverlayChange = useCallback(
    (overlay: LogoOverlay | null) => {
      setLogoOverlay(overlay)
    },
    []
  )

  const waveLogoData: WaveLogoData | null = logoOverlay
    ? {
        svgContent: logoOverlay.svgContent,
        nativeWidth: logoOverlay.nativeWidth,
        nativeHeight: logoOverlay.nativeHeight,
        nativeMinX: logoOverlay.nativeMinX,
        nativeMinY: logoOverlay.nativeMinY,
      }
    : null

  const handleBack = () => {
    router.push('/app/design')
  }

  const handleNext = () => {
    router.push('/app/generate')
  }

  return (
    <>
      <AppNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              Wave
              <br />
              Pattern
            </h1>
            <p className="text-neutral-500 mt-4 text-lg">
              Generate animated 3D wave point clouds with directional flow
              vectors
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-400 flex items-center justify-center text-sm font-medium">
                1
              </span>
              <span className="text-sm uppercase tracking-wider text-neutral-400">
                Select Design Model
              </span>
            </div>
            <div className="h-px bg-neutral-300 flex-1 max-w-24" />
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-sm font-medium">
                2
              </span>
              <span className="text-sm uppercase tracking-wider font-medium">
                Create Pattern
              </span>
            </div>
            <div className="h-px bg-neutral-300 flex-1 max-w-24" />
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-400 flex items-center justify-center text-sm font-medium">
                3
              </span>
              <span className="text-sm uppercase tracking-wider text-neutral-400">
                AI Generate
              </span>
            </div>
          </div>

          {/* Two-column layout: Viewer + Parameters */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 mb-12">
            {/* Left: Sticky viewer */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="aspect-square bg-white border border-black/10 relative overflow-hidden">
                <WavePatternViewer params={params} logoData={waveLogoData} />
              </div>
            </div>

            {/* Right: Scrollable parameters panel */}
            <div className="border border-black/10 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-black/10 px-5 py-3 z-10">
                <p className="text-sm uppercase tracking-wider font-medium">
                  Parameters
                </p>
              </div>
              <div className="p-5 space-y-8">
                <WavePatternControls
                  params={params}
                  onChange={handleParamChange}
                />

                <LogoImport
                  logos={logos}
                  logoOverlay={logoOverlay}
                  onLogoOverlayChange={handleLogoOverlayChange}
                  viewerDimensions={{ width: 500, height: 500 }}
                  hideFillColor
                />
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-4 border border-black/20 text-black text-sm uppercase tracking-widest font-medium hover:bg-neutral-100 transition-colors flex items-center gap-3"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16l-4-4m0 0l4-4m-4 4h18"
                />
              </svg>
              Back
            </button>
            <button
              onClick={handleNext}
              className="px-8 py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors flex items-center gap-3"
            >
              Next
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
