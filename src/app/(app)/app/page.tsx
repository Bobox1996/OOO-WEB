'use client'

import { useRouter } from 'next/navigation'
import AppNav from '@/components/layout/AppNav'

export default function SelectDesignerPage() {
  const router = useRouter()

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
      id: 'coming-soon',
      name: 'Coming Soon',
      description: 'More designers are on the way. Stay tuned for new creative tools.',
      href: '#',
      available: false,
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
                  className={`aspect-square w-full flex items-center justify-center overflow-hidden ${
                    designer.available ? 'bg-white' : 'bg-neutral-50'
                  }`}
                >
                  {designer.id === 'pattern' ? (
                    <svg
                      viewBox="0 0 200 200"
                      className="w-3/4 h-3/4 text-black/80 group-hover:text-black transition-colors"
                    >
                      {/* Grid lines */}
                      {[0, 40, 80, 120, 160, 200].map((pos) => (
                        <line
                          key={`v-${pos}`}
                          x1={pos}
                          y1={0}
                          x2={pos}
                          y2={200}
                          stroke="currentColor"
                          strokeWidth={1}
                        />
                      ))}
                      {[0, 40, 80, 120, 160, 200].map((pos) => (
                        <line
                          key={`h-${pos}`}
                          x1={0}
                          y1={pos}
                          x2={200}
                          y2={pos}
                          stroke="currentColor"
                          strokeWidth={1}
                        />
                      ))}
                      {/* Sample text at vertices */}
                      {[40, 120].map((x) =>
                        [40, 120].map((y) => (
                          <text
                            key={`t-${x}-${y}`}
                            x={x}
                            y={y + 4}
                            textAnchor="middle"
                            fontSize={10}
                            fill="currentColor"
                            fontWeight={400}
                          >
                            OOO
                          </text>
                        ))
                      )}
                    </svg>
                  ) : designer.id === 'metaball' ? (
                    <svg
                      viewBox="0 0 200 200"
                      className="w-3/4 h-3/4 text-black/80 group-hover:text-black transition-colors"
                    >
                      {/* Metaball blob preview — two overlapping organic shapes */}
                      <path
                        d="M60 100 C60 65, 85 45, 100 45 C115 45, 130 55, 135 70 C140 55, 155 45, 170 55 C185 65, 185 90, 170 105 C185 115, 185 140, 170 150 C155 160, 140 150, 135 135 C130 150, 115 160, 100 160 C85 160, 60 140, 60 100Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      />
                      <path
                        d="M30 110 C30 80, 50 60, 75 60 C90 60, 95 70, 95 80 C95 70, 100 60, 115 60 C135 60, 155 80, 155 110 C155 140, 135 160, 115 160 C100 160, 95 150, 95 140 C95 150, 90 160, 75 160 C50 160, 30 140, 30 110Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        opacity={0.4}
                      />
                      {/* Charge dots */}
                      <circle cx={75} cy={100} r={3} fill="currentColor" opacity={0.3} />
                      <circle cx={115} cy={100} r={3} fill="currentColor" opacity={0.3} />
                      <circle cx={95} cy={75} r={3} fill="currentColor" opacity={0.3} />
                    </svg>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-neutral-300">
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
