'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AppNav from '@/components/layout/AppNav'
import PatternViewer from '@/components/sections/PatternViewer'
import MetaballViewer from '@/components/sections/MetaballViewer'
import { generatePoints } from '@/lib/utils/metaball.utils'

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

  const { charges, passThroughPoints } = useMemo(
    () => generatePoints(METABALL_DEFAULTS.totalPoints, METABALL_DEFAULTS.chargeCount, METABALL_DEFAULTS.seed),
    [],
  )

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
