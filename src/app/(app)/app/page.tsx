'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppNav from '@/components/layout/AppNav'
import PatternViewer from '@/components/sections/PatternViewer'
import PatternControls, { GridParams } from '@/components/sections/PatternControls'
import ViewerContainer from '@/components/sections/ViewerContainer'
import { createClient } from '@/services/supabase/client'
import { AppPattern } from '@/types'

export default function AppPage() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const supabase = createClient()

  // Grid parameters state
  const [params, setParams] = useState<GridParams>({
    columns: 8,
    rows: 8,
    strokeWeight: 0.5,
    strokeColor: '#000000',
    slogan: '',
    sloganWeight: 400,
    sloganColor: '#000000',
  })

  // Recent patterns state
  const [recentPatterns, setRecentPatterns] = useState<AppPattern[]>([])
  const [patternsLoading, setPatternsLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Fetch recent patterns on mount
  useEffect(() => {
    const fetchPatterns = async () => {
      setPatternsLoading(true)
      
      // Fetch pinned patterns first, then recent non-pinned, limit to 6 total
      const { data: pinnedData } = await supabase
        .from('app_patterns')
        .select('*')
        .eq('pinned', true)
        .order('created_at', { ascending: false })

      const pinnedPatterns = pinnedData || []
      const remainingSlots = Math.max(0, 6 - pinnedPatterns.length)

      let recentNonPinned: AppPattern[] = []
      if (remainingSlots > 0) {
        const { data: recentData } = await supabase
          .from('app_patterns')
          .select('*')
          .eq('pinned', false)
          .order('created_at', { ascending: false })
          .limit(remainingSlots)

        recentNonPinned = recentData || []
      }

      setRecentPatterns([...pinnedPatterns, ...recentNonPinned])
      setPatternsLoading(false)
    }

    fetchPatterns()
  }, [supabase])

  const handleParamChange = (newParams: Partial<GridParams>) => {
    setParams((prev) => ({ ...prev, ...newParams }))
  }

  const handleNext = async () => {
    if (!svgRef.current) return

    setSaving(true)
    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(svgRef.current)
    const base64 = btoa(unescape(encodeURIComponent(svgString)))

    // Save to localStorage for the generate page
    localStorage.setItem('patternSVG', base64)

    // Save to database
    const { data: userData } = await supabase.auth.getUser()
    if (userData.user) {
      // Check if we need to delete old non-pinned patterns to maintain limit
      const { data: existingPatterns } = await supabase
        .from('app_patterns')
        .select('id, pinned')
        .eq('pinned', false)
        .order('created_at', { ascending: false })

      // If we have 6+ non-pinned patterns, delete the oldest ones
      if (existingPatterns && existingPatterns.length >= 6) {
        const patternsToDelete = existingPatterns.slice(5) // Keep only 5, new one will make 6
        for (const pattern of patternsToDelete) {
          await supabase.from('app_patterns').delete().eq('id', pattern.id)
        }
      }

      // Insert the new pattern
      await supabase.from('app_patterns').insert({
        user_id: userData.user.id,
        columns: params.columns,
        rows: params.rows,
        stroke_weight: params.strokeWeight,
        stroke_color: params.strokeColor,
        slogan: params.slogan || null,
        slogan_weight: params.sloganWeight,
        slogan_color: params.sloganColor,
        svg_preview: base64,
        pinned: false,
      })
    }

    setSaving(false)
    router.push('/app/generate')
  }

  const handleLoadPattern = (pattern: AppPattern) => {
    setParams({
      columns: pattern.columns,
      rows: pattern.rows,
      strokeWeight: pattern.stroke_weight,
      strokeColor: pattern.stroke_color,
      slogan: pattern.slogan || '',
      sloganWeight: pattern.slogan_weight || 400,
      sloganColor: pattern.slogan_color || '#000000',
    })
  }

  const handleTogglePin = async (pattern: AppPattern) => {
    const newPinned = !pattern.pinned

    await supabase
      .from('app_patterns')
      .update({ pinned: newPinned })
      .eq('id', pattern.id)

    // Update local state
    setRecentPatterns((prev) =>
      prev.map((p) => (p.id === pattern.id ? { ...p, pinned: newPinned } : p))
    )
  }

  const handleDeletePattern = async (patternId: string) => {
    await supabase.from('app_patterns').delete().eq('id', patternId)

    // Update local state
    setRecentPatterns((prev) => prev.filter((p) => p.id !== patternId))
  }

  return (
    <>
      <AppNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              Pattern
              <br />
              Designer
            </h1>
            <p className="text-neutral-500 mt-4 text-lg">
              Create parametric SVG patterns for AI generation
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-sm font-medium">
                1
              </span>
              <span className="text-sm uppercase tracking-wider font-medium">Create Pattern</span>
            </div>
            <div className="h-px bg-neutral-300 flex-1 max-w-24" />
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-400 flex items-center justify-center text-sm font-medium">
                2
              </span>
              <span className="text-sm uppercase tracking-wider text-neutral-400">AI Generate</span>
            </div>
          </div>

          {/* SVG Viewer */}
          <div className="mb-8">
            <p className="block text-sm uppercase tracking-wider text-neutral-500 mb-4">
              Pattern Preview
            </p>
            <div className="aspect-square max-w-2xl bg-white border border-black/10 overflow-hidden relative">
              <ViewerContainer>
                <PatternViewer
                  ref={svgRef}
                  columns={params.columns}
                  rows={params.rows}
                  strokeWeight={params.strokeWeight}
                  strokeColor={params.strokeColor}
                  slogan={params.slogan}
                  sloganWeight={params.sloganWeight}
                  sloganColor={params.sloganColor}
                />
              </ViewerContainer>
            </div>
          </div>

          {/* Controls */}
          <div className="mb-12">
            <p className="block text-sm uppercase tracking-wider text-neutral-500 mb-4">
              Pattern Parameters
            </p>
            <PatternControls
              columns={params.columns}
              rows={params.rows}
              strokeWeight={params.strokeWeight}
              strokeColor={params.strokeColor}
              slogan={params.slogan}
              sloganWeight={params.sloganWeight}
              sloganColor={params.sloganColor}
              onChange={handleParamChange}
            />
          </div>

          {/* Recent Patterns */}
          <div className="mb-12">
            <p className="block text-sm uppercase tracking-wider text-neutral-500 mb-4">
              Recent Patterns
            </p>
            {patternsLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-24 h-24 bg-neutral-200 animate-pulse"
                  />
                ))}
              </div>
            ) : recentPatterns.length === 0 ? (
              <div className="bg-neutral-100 border border-black/10 p-8 text-center">
                <p className="text-neutral-500 text-sm">No saved patterns yet. Create one and click Next to save.</p>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {recentPatterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    className="flex-shrink-0 w-24 h-24 relative group"
                  >
                    {/* Pattern Preview */}
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

                    {/* Pin Button */}
                    <button
                      onClick={() => handleTogglePin(pattern)}
                      className={`absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        pattern.pinned
                          ? 'bg-black text-white'
                          : 'bg-white/80 text-neutral-400 opacity-0 group-hover:opacity-100'
                      }`}
                      title={pattern.pinned ? 'Unpin' : 'Pin'}
                    >
                      <svg
                        className="w-3 h-3"
                        fill={pattern.pinned ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                        />
                      </svg>
                    </button>

                    {/* Delete Button */}
                    {!pattern.pinned && (
                      <button
                        onClick={() => handleDeletePattern(pattern.id)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/80 text-neutral-400 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next Button */}
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              disabled={saving}
              className="px-8 py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
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
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
