'use client'

import React from 'react'

export interface GridParams {
  columns: number
  rows: number
  strokeWeight: number
  strokeColor: string
  slogan: string
  sloganWeight: number
  sloganColor: string
}

interface PatternControlsProps {
  columns: number
  rows: number
  strokeWeight: number
  strokeColor: string
  slogan: string
  sloganWeight: number
  sloganColor: string
  onChange: (params: Partial<GridParams>) => void
}

export default function PatternControls({
  columns,
  rows,
  strokeWeight,
  strokeColor,
  slogan,
  sloganWeight,
  sloganColor,
  onChange,
}: PatternControlsProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
        </div>
      </div>
    </div>
  )
}
