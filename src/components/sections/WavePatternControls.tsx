'use client'

import { useState, useEffect } from 'react'
import { WaveParams } from './WavePatternViewer'

interface WavePatternControlsProps {
  params: WaveParams
  onChange: (params: Partial<WaveParams>) => void
}

export default function WavePatternControls({
  params,
  onChange,
}: WavePatternControlsProps) {
  const [seedInput, setSeedInput] = useState(String(params.seed))
  const [densityInput, setDensityInput] = useState(String(params.density))

  useEffect(() => { setSeedInput(String(params.seed)) }, [params.seed])
  useEffect(() => { setDensityInput(String(params.density)) }, [params.density])

  const commitSeed = () => {
    const parsed = parseInt(seedInput)
    const val = isNaN(parsed) ? 0 : Math.max(0, parsed)
    setSeedInput(String(val))
    onChange({ seed: val })
  }

  const commitDensity = () => {
    const parsed = parseInt(densityInput)
    const val = isNaN(parsed) ? 200 : Math.max(200, Math.min(2000, parsed))
    setDensityInput(String(val))
    onChange({ density: val })
  }

  return (
    <div className="space-y-6">
      {/* Seed & Density */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="wave-seed"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Seed
          </label>
          <input
            type="number"
            id="wave-seed"
            min={0}
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            onBlur={commitSeed}
            onKeyDown={(e) => { if (e.key === 'Enter') commitSeed() }}
            className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg"
          />
        </div>
        <div>
          <label
            htmlFor="wave-density"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Density
          </label>
          <input
            type="number"
            id="wave-density"
            min={200}
            max={2000}
            value={densityInput}
            onChange={(e) => setDensityInput(e.target.value)}
            onBlur={commitDensity}
            onKeyDown={(e) => { if (e.key === 'Enter') commitDensity() }}
            className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg"
          />
        </div>
      </div>

      {/* Render Mode */}
      <div>
        <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
          Render Mode
        </label>
        <div className="flex gap-2">
          {(['points', 'lattice', 'both'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onChange({ renderMode: mode })}
              className={`flex-1 py-2.5 text-xs uppercase tracking-wider border transition-colors ${
                params.renderMode === mode
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-black/20 hover:bg-neutral-100'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Point Size (visible for points and both modes) */}
      {(params.renderMode === 'points' || params.renderMode === 'both') && (
        <div>
          <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
            Point Size
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.02}
              max={0.5}
              step={0.01}
              value={params.pointSize}
              onChange={(e) =>
                onChange({ pointSize: parseFloat(e.target.value) })
              }
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <span className="text-xs text-neutral-600 w-10 text-right">
              {params.pointSize.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Show Vectors */}
      <div className="flex items-center justify-between">
        <label className="text-sm uppercase tracking-wider text-neutral-500">
          Direction Vectors
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={params.showVectors}
          onClick={() => onChange({ showVectors: !params.showVectors })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            params.showVectors ? 'bg-black' : 'bg-neutral-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              params.showVectors ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {params.showVectors && (
        <div>
          <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
            Vector Length
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.1}
              max={2.0}
              step={0.05}
              value={params.vectorLength}
              onChange={(e) =>
                onChange({ vectorLength: parseFloat(e.target.value) })
              }
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <span className="text-xs text-neutral-600 w-10 text-right">
              {params.vectorLength.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Wave Parameters */}
      <div className="border-t border-black/10 pt-6">
        <p className="text-sm uppercase tracking-wider text-neutral-500 mb-4">
          Wave Parameters
        </p>

        {/* Amplitudes */}
        <div className="space-y-4 mb-6">
          <p className="text-xs uppercase tracking-wider text-neutral-400">
            Amplitudes
          </p>
          {([
            ['amp1', 'Amp 1 (sin X)', 0, 3],
            ['amp2', 'Amp 2 (cos Y)', 0, 3],
            ['amp3', 'Amp 3 (radial)', 0, 3],
          ] as const).map(([key, label, min, max]) => (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-neutral-500">{label}</label>
                <span className="text-xs text-neutral-600">
                  {(params[key] as number).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={0.05}
                value={params[key] as number}
                onChange={(e) =>
                  onChange({ [key]: parseFloat(e.target.value) })
                }
                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
              />
            </div>
          ))}
        </div>

        {/* Frequencies */}
        <div className="space-y-4 mb-6">
          <p className="text-xs uppercase tracking-wider text-neutral-400">
            Frequencies
          </p>
          {([
            ['freqX', 'Freq X', 0, 2],
            ['freqY', 'Freq Y', 0, 2],
            ['freqR', 'Freq Radial', 0, 2],
          ] as const).map(([key, label, min, max]) => (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-neutral-500">{label}</label>
                <span className="text-xs text-neutral-600">
                  {(params[key] as number).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={0.05}
                value={params[key] as number}
                onChange={(e) =>
                  onChange({ [key]: parseFloat(e.target.value) })
                }
                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
              />
            </div>
          ))}
        </div>

        {/* Speeds */}
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wider text-neutral-400">
            Animation Speeds
          </p>
          {([
            ['speed1', 'Speed 1', 0, 3],
            ['speed2', 'Speed 2', 0, 3],
            ['speed3', 'Speed 3', 0, 3],
          ] as const).map(([key, label, min, max]) => (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-neutral-500">{label}</label>
                <span className="text-xs text-neutral-600">
                  {(params[key] as number).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={0.05}
                value={params[key] as number}
                onChange={(e) =>
                  onChange({ [key]: parseFloat(e.target.value) })
                }
                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Falloff */}
      <div className="border-t border-black/10 pt-6">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm uppercase tracking-wider text-neutral-500">
            Radial Falloff
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={params.useFalloff}
            onClick={() => onChange({ useFalloff: !params.useFalloff })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              params.useFalloff ? 'bg-black' : 'bg-neutral-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                params.useFalloff ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {params.useFalloff && (
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-neutral-500">Strength</label>
              <span className="text-xs text-neutral-600">
                {params.falloff.toFixed(3)}
              </span>
            </div>
            <input
              type="range"
              min={0.001}
              max={0.1}
              step={0.001}
              value={params.falloff}
              onChange={(e) =>
                onChange({ falloff: parseFloat(e.target.value) })
              }
              className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
          </div>
        )}
      </div>

      {/* Logo Scale */}
      <div className="border-t border-black/10 pt-6">
        <div>
          <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
            Logo Scale
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.1}
              value={params.logoScale}
              onChange={(e) =>
                onChange({ logoScale: parseFloat(e.target.value) })
              }
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <span className="text-xs text-neutral-600 w-10 text-right">
              {params.logoScale.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
