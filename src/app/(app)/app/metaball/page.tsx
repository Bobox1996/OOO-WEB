'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppNav from '@/components/layout/AppNav'
import MetaballViewer from '@/components/sections/MetaballViewer'
import MetaballControls, { MetaballParams } from '@/components/sections/MetaballControls'
import ViewerContainer from '@/components/sections/ViewerContainer'
import LogoImport, { LogoOverlay } from '@/components/sections/LogoImport'
import { generatePoints } from '@/lib/utils/metaball.utils'
import { createClient } from '@/services/supabase/client'
import { AppMetaballPattern, AppUserLogo } from '@/types'

const DEFAULT_PARAMS: MetaballParams = {
  totalPoints: 60,
  chargeCount: 40,
  seed: 5,
  accuracy: 0.02,
  strokeWeight: 0.01,
  strokeColor: '#000000',
  fillSetIndex: -1,
  fillColor: '#F0EEE9',
}

export default function MetaballPage() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const supabase = createClient()
  const [params, setParams] = useState<MetaballParams>(DEFAULT_PARAMS)
  const [saving, setSaving] = useState(false)
  const [recentPatterns, setRecentPatterns] = useState<AppMetaballPattern[]>([])
  const [patternsLoading, setPatternsLoading] = useState(true)
  const [logos, setLogos] = useState<AppUserLogo[]>([])
  const [logoOverlay, setLogoOverlay] = useState<LogoOverlay | null>(null)
  const [logoSelected, setLogoSelected] = useState(false)

  const { charges, passThroughPoints } = useMemo(
    () => generatePoints(params.totalPoints, params.chargeCount, params.seed),
    [params.totalPoints, params.chargeCount, params.seed],
  )

  useEffect(() => {
    const fetchPatterns = async () => {
      setPatternsLoading(true)
      const { data: pinnedData } = await supabase
        .from('app_metaball_patterns')
        .select('*')
        .eq('pinned', true)
        .order('created_at', { ascending: false })

      const pinnedPatterns = pinnedData || []
      const remainingSlots = Math.max(0, 6 - pinnedPatterns.length)

      let recentNonPinned: AppMetaballPattern[] = []
      if (remainingSlots > 0) {
        const { data: recentData } = await supabase
          .from('app_metaball_patterns')
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
      if (data) setLogos(data)
    }

    fetchPatterns()
    fetchLogos()
  }, [supabase])

  const handleParamChange = useCallback((update: Partial<MetaballParams>) => {
    setParams((prev) => ({ ...prev, ...update }))
  }, [])

  const handleLogoMove = useCallback((x: number, y: number) => {
    setLogoOverlay((prev) => prev ? { ...prev, x, y } : null)
  }, [])

  const handleLogoScale = useCallback((scale: number) => {
    setLogoOverlay((prev) => prev ? { ...prev, scale } : null)
  }, [])

  const handleLogoRotate = useCallback((rotation: number) => {
    setLogoOverlay((prev) => prev ? { ...prev, rotation } : null)
  }, [])

  const handleLogoSelect = useCallback(() => {
    setLogoSelected(true)
  }, [])

  const handleLogoDeselect = useCallback(() => {
    setLogoSelected(false)
  }, [])

  const handleLogoOverlayChange = useCallback((overlay: LogoOverlay | null) => {
    setLogoOverlay(overlay)
    if (!overlay) setLogoSelected(false)
  }, [])

  const viewerDimensions = useMemo(() => {
    const allPts = [...charges, ...passThroughPoints]
    if (allPts.length === 0) return { width: 12, height: 12 }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of allPts) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    const pad = Math.max(maxX - minX, maxY - minY) * 0.1 || 1
    return { width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 }
  }, [charges, passThroughPoints])

  const handleDownload = () => {
    if (!svgRef.current) return
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svgRef.current)
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'metaball-isocurve.svg'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleNext = async () => {
    if (!svgRef.current) return
    setSaving(true)
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svgRef.current)
    const base64 = btoa(unescape(encodeURIComponent(svgString)))

    localStorage.setItem('patternSVG', base64)
    localStorage.setItem('patternSource', 'metaball')

    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      const { data: existingPatterns } = await supabase
        .from('app_metaball_patterns')
        .select('id, pinned')
        .eq('pinned', false)
        .order('created_at', { ascending: false })

      if (existingPatterns && existingPatterns.length >= 6) {
        const patternsToDelete = existingPatterns.slice(5)
        for (const pattern of patternsToDelete) {
          await supabase.from('app_metaball_patterns').delete().eq('id', pattern.id)
        }
      }

      const { data: inserted } = await supabase.from('app_metaball_patterns').insert({
        user_id: userData.user.id,
        total_points: params.totalPoints,
        charge_count: params.chargeCount,
        seed: params.seed,
        accuracy: params.accuracy,
        stroke_weight: params.strokeWeight,
        stroke_color: params.strokeColor,
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

  const handleLoadPattern = (pattern: AppMetaballPattern) => {
    setParams((prev) => ({
      ...prev,
      totalPoints: pattern.total_points,
      chargeCount: pattern.charge_count,
      seed: pattern.seed,
      accuracy: pattern.accuracy,
      strokeWeight: pattern.stroke_weight,
      strokeColor: pattern.stroke_color,
    }))
  }

  const handleTogglePin = async (pattern: AppMetaballPattern) => {
    const newPinned = !pattern.pinned
    await supabase
      .from('app_metaball_patterns')
      .update({ pinned: newPinned })
      .eq('id', pattern.id)
    setRecentPatterns((prev) =>
      prev.map((p) => (p.id === pattern.id ? { ...p, pinned: newPinned } : p))
    )
  }

  const handleDeletePattern = async (patternId: string) => {
    await supabase.from('app_metaball_patterns').delete().eq('id', patternId)
    setRecentPatterns((prev) => prev.filter((p) => p.id !== patternId))
  }

  return (
    <>
      <AppNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
                Metaball
                <br />
                Isocurve
              </h1>
              <button
                onClick={handleDownload}
                className="px-4 py-2 text-xs uppercase tracking-wider border border-black/20 hover:bg-neutral-100 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download SVG
              </button>
            </div>
            <p className="text-neutral-500 mt-4 text-lg">
              Generate 2D metaball isocurves through points with marching squares
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
              <div className="aspect-square bg-white border border-black/10 overflow-hidden relative">
                <ViewerContainer
                  logoOverlay={logoOverlay}
                  onLogoMove={handleLogoMove}
                  onLogoScale={handleLogoScale}
                  onLogoRotate={handleLogoRotate}
                  onLogoSelect={handleLogoSelect}
                  onLogoDeselect={handleLogoDeselect}
                >
                  <MetaballViewer
                    ref={svgRef}
                    charges={charges}
                    passThroughPoints={passThroughPoints}
                    accuracy={params.accuracy}
                    strokeWeight={params.strokeWeight}
                    strokeColor={params.strokeColor}
                    fillSetIndex={params.fillSetIndex}
                    fillColor={params.fillColor}
                    logoOverlay={logoOverlay}
                    logoSelected={logoSelected}
                  />
                </ViewerContainer>
              </div>
            </div>

            {/* Right: Scrollable parameters panel */}
            <div className="border border-black/10 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-black/10 px-5 py-3 z-10">
                <p className="text-sm uppercase tracking-wider font-medium">Parameters</p>
              </div>
              <div className="p-5 space-y-8">
                <MetaballControls params={params} onChange={handleParamChange} />

                <LogoImport
                  logos={logos}
                  logoOverlay={logoOverlay}
                  onLogoOverlayChange={handleLogoOverlayChange}
                  viewerDimensions={viewerDimensions}
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
              disabled={saving}
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
