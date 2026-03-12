'use client'

import React from 'react'
import ColorPalettePicker from './ColorPalettePicker'

export const FONT_OPTIONS = [
  { label: 'Zilla Slab', value: 'var(--font-zilla-slab), "Zilla Slab", serif' },
  { label: 'ITC Lubalin Graph', value: '"ITC Lubalin Graph", serif' },
  { label: 'Inter', value: 'var(--font-inter), Inter, sans-serif' },
  { label: 'IBM Plex Sans Condensed', value: 'var(--font-ibm-plex-sans-condensed), "IBM Plex Sans Condensed", sans-serif' },
  { label: 'Barlow Condensed', value: 'var(--font-barlow-condensed), "Barlow Condensed", sans-serif' },
] as const

export interface GridParams {
  columns: number
  rows: number
  strokeWeight: number
  strokeColor: string
  slogan: string
  sloganFont: string
  sloganWeight: number
  sloganColor: string
  weightRandom: boolean
  rotationRandom: number
  positionRandom: number
  randomSeed: number
}

interface PatternControlsProps {
  columns: number
  rows: number
  strokeWeight: number
  strokeColor: string
  slogan: string
  sloganFont: string
  sloganWeight: number
  sloganColor: string
  weightRandom: boolean
  rotationRandom: number
  positionRandom: number
  randomSeed: number
  onChange: (params: Partial<GridParams>) => void
}

export default function PatternControls({
  columns,
  rows,
  strokeWeight,
  strokeColor,
  slogan,
  sloganFont,
  sloganWeight,
  sloganColor,
  weightRandom,
  rotationRandom,
  positionRandom,
  randomSeed,
  onChange,
}: PatternControlsProps) {
  return (
    <div className="space-y-6">
      {/* Grid Size */}
      <div className="grid grid-cols-2 gap-6">
        {/* Columns */}
        <div>
          <label
            htmlFor="columns"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Columns
          </label>
          <input
            type="number"
            id="columns"
            min={1}
            max={50}
            value={columns}
            onChange={(e) => onChange({ columns: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) })}
            className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg"
          />
        </div>

        {/* Rows */}
        <div>
          <label
            htmlFor="rows"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Rows
          </label>
          <input
            type="number"
            id="rows"
            min={1}
            max={50}
            value={rows}
            onChange={(e) => onChange({ rows: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) })}
            className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg"
          />
        </div>
      </div>

      {/* Stroke */}
      <div className="grid grid-cols-2 gap-6">
        {/* Stroke Weight */}
        <div>
          <label
            htmlFor="strokeWeight"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Stroke Weight
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              id="strokeWeight"
              min={0.5}
              max={10}
              step={0.5}
              value={strokeWeight}
              onChange={(e) => onChange({ strokeWeight: parseFloat(e.target.value) })}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <span className="text-sm text-neutral-600 w-8 text-right">{strokeWeight}</span>
          </div>
        </div>

        {/* Stroke Color */}
        <div>
          <label
            htmlFor="strokeColor"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Stroke Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id="strokeColor"
              value={strokeColor}
              onChange={(e) => onChange({ strokeColor: e.target.value })}
              className="w-12 h-12 border border-black/20 cursor-pointer bg-white p-1"
            />
            <span className="text-sm text-neutral-600 uppercase">{strokeColor}</span>
          </div>
          <ColorPalettePicker onSelectColor={(hex) => onChange({ strokeColor: hex })} />
        </div>
      </div>

      {/* Slogan Input */}
      <div>
        <label
          htmlFor="slogan"
          className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
        >
          Enter Your Slogan
        </label>
        <textarea
          id="slogan"
          value={slogan}
          onChange={(e) => onChange({ slogan: e.target.value })}
          placeholder="Type your slogan here... (press Enter for new line)"
          rows={3}
          className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg resize-none"
        />
      </div>

      {/* Font Selection */}
      <div>
        <label
          htmlFor="sloganFont"
          className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
        >
          Font
        </label>
        <select
          id="sloganFont"
          value={sloganFont}
          onChange={(e) => onChange({ sloganFont: e.target.value })}
          className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg appearance-none cursor-pointer"
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font.label} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </div>

      {/* Slogan Font Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Font Thickness */}
        <div>
          <label
            htmlFor="sloganWeight"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Font Thickness
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              id="sloganWeight"
              min={100}
              max={1000}
              step={100}
              value={sloganWeight}
              onChange={(e) => onChange({ sloganWeight: parseInt(e.target.value) })}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <span className="text-sm text-neutral-600 w-12 text-right">{sloganWeight}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs uppercase tracking-wider text-neutral-400">Randomize</span>
            <button
              type="button"
              role="switch"
              aria-checked={weightRandom}
              onClick={() => onChange({ weightRandom: !weightRandom })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                weightRandom ? 'bg-black' : 'bg-neutral-300'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                weightRandom ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>

        {/* Text Color */}
        <div>
          <label
            htmlFor="sloganColor"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Text Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id="sloganColor"
              value={sloganColor}
              onChange={(e) => onChange({ sloganColor: e.target.value })}
              className="w-12 h-12 border border-black/20 cursor-pointer bg-white p-1"
            />
            <span className="text-sm text-neutral-600 uppercase">{sloganColor}</span>
          </div>
          <ColorPalettePicker onSelectColor={(hex) => onChange({ sloganColor: hex })} />
        </div>
      </div>

      {/* Randomization Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rotation Random */}
        <div>
          <label
            htmlFor="rotationRandom"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Rotation Random
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              id="rotationRandom"
              min={0}
              max={60}
              step={1}
              value={rotationRandom}
              onChange={(e) => onChange({ rotationRandom: parseInt(e.target.value) })}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <span className="text-sm text-neutral-600 w-12 text-right">{rotationRandom}°</span>
          </div>
        </div>

        {/* Seed */}
        <div>
          <label
            htmlFor="randomSeed"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Seed
          </label>
          <input
            type="number"
            id="randomSeed"
            min={0}
            value={randomSeed}
            onChange={(e) => onChange({ randomSeed: Math.max(0, parseInt(e.target.value) || 0) })}
            className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg"
          />
        </div>

        {/* Position Random */}
        <div>
          <label
            htmlFor="positionRandom"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Position Random
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              id="positionRandom"
              min={0}
              max={0.5}
              step={0.01}
              value={positionRandom}
              onChange={(e) => onChange({ positionRandom: parseFloat(e.target.value) })}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <span className="text-sm text-neutral-600 w-12 text-right">{positionRandom}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
