'use client'

import React, { useState, useEffect } from 'react'
import ColorPalettePicker from './ColorPalettePicker'

export interface AsawaParams {
  rows: number
  columns: number
  strokeWeight: number
  strokeColor: string
  rotationRandom: number
  positionRandom: number
  randomSeed: number
}

interface AsawaControlsProps {
  rows: number
  columns: number
  strokeWeight: number
  strokeColor: string
  rotationRandom: number
  positionRandom: number
  randomSeed: number
  onChange: (params: Partial<AsawaParams>) => void
}

export default function AsawaControls({
  rows,
  columns,
  strokeWeight,
  strokeColor,
  rotationRandom,
  positionRandom,
  randomSeed,
  onChange,
}: AsawaControlsProps) {
  const [columnsInput, setColumnsInput] = useState(String(columns))
  const [rowsInput, setRowsInput] = useState(String(rows))
  const [seedInput, setSeedInput] = useState(String(randomSeed))

  useEffect(() => { setColumnsInput(String(columns)) }, [columns])
  useEffect(() => { setRowsInput(String(rows)) }, [rows])
  useEffect(() => { setSeedInput(String(randomSeed)) }, [randomSeed])

  const commitValue = (
    raw: string,
    min: number,
    max: number | null,
    fallback: number,
    key: keyof AsawaParams,
    setLocal: (v: string) => void,
  ) => {
    const parsed = parseInt(raw)
    let clamped = isNaN(parsed) ? fallback : Math.max(min, parsed)
    if (max !== null) clamped = Math.min(max, clamped)
    setLocal(String(clamped))
    onChange({ [key]: clamped })
  }

  return (
    <div className="space-y-6">
      {/* Grid Size */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="asawa-columns"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Columns
          </label>
          <input
            type="number"
            id="asawa-columns"
            min={20}
            max={40}
            value={columnsInput}
            onChange={(e) => setColumnsInput(e.target.value)}
            onBlur={() => commitValue(columnsInput, 20, 40, 20, 'columns', setColumnsInput)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitValue(columnsInput, 20, 40, 20, 'columns', setColumnsInput) }}
            className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg"
          />
        </div>

        <div>
          <label
            htmlFor="asawa-rows"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Rows
          </label>
          <input
            type="number"
            id="asawa-rows"
            min={20}
            max={40}
            value={rowsInput}
            onChange={(e) => setRowsInput(e.target.value)}
            onBlur={() => commitValue(rowsInput, 20, 40, 20, 'rows', setRowsInput)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitValue(rowsInput, 20, 40, 20, 'rows', setRowsInput) }}
            className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg"
          />
        </div>
      </div>

      {/* Stroke */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="asawa-strokeWeight"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Stroke Weight
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              id="asawa-strokeWeight"
              min={0.1}
              max={5}
              step={0.1}
              value={strokeWeight}
              onChange={(e) => onChange({ strokeWeight: parseFloat(e.target.value) })}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <span className="text-sm text-neutral-600 w-8 text-right">{strokeWeight}</span>
          </div>
        </div>

        <div>
          <label
            htmlFor="asawa-strokeColor"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Stroke Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id="asawa-strokeColor"
              value={strokeColor === 'transparent' ? '#000000' : strokeColor}
              onChange={(e) => onChange({ strokeColor: e.target.value })}
              className="w-12 h-12 border border-black/20 cursor-pointer bg-white p-1"
            />
            <span className="text-sm text-neutral-600 uppercase">{strokeColor === 'transparent' ? 'none' : strokeColor}</span>
          </div>
          <ColorPalettePicker onSelectColor={(hex) => onChange({ strokeColor: hex })} />
        </div>
      </div>

      {/* Randomization Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="asawa-rotationRandom"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Rotation Random
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              id="asawa-rotationRandom"
              min={0}
              max={360}
              step={1}
              value={rotationRandom}
              onChange={(e) => onChange({ rotationRandom: parseInt(e.target.value) })}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <span className="text-sm text-neutral-600 w-12 text-right">{rotationRandom}&deg;</span>
          </div>
        </div>

        <div>
          <label
            htmlFor="asawa-randomSeed"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Seed
          </label>
          <input
            type="number"
            id="asawa-randomSeed"
            min={0}
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            onBlur={() => commitValue(seedInput, 0, null, 0, 'randomSeed', setSeedInput)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitValue(seedInput, 0, null, 0, 'randomSeed', setSeedInput) }}
            className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg"
          />
        </div>

        <div>
          <label
            htmlFor="asawa-positionRandom"
            className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
          >
            Position Random
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              id="asawa-positionRandom"
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
