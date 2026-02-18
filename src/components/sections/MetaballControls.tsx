'use client'

import React from 'react'

export interface MetaballParams {
  totalPoints: number
  chargeCount: number
  seed: number
  accuracy: number | null
  strokeWeight: number
  strokeColor: string
  /** Index of the isocurve set to fill (-1 = none). Sets sorted by area. */
  fillSetIndex: number
  /** Fill color for the selected isocurve set */
  fillColor: string
}

interface MetaballControlsProps {
  params: MetaballParams
  onChange: (params: Partial<MetaballParams>) => void
}

export default function MetaballControls({ params, onChange }: MetaballControlsProps) {
  const { totalPoints, chargeCount, seed, accuracy, strokeWeight, strokeColor, fillSetIndex, fillColor } = params
  const maxSetIndex = Math.max(0, totalPoints - chargeCount - 1)

  return (
    <div className="space-y-8">
      {/* ── Point generation inputs ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {/* Total Points */}
        <div className="flex flex-col">
          <label
            htmlFor="totalPoints"
            className="text-sm uppercase tracking-wider text-neutral-500 mb-2 min-h-[2.5rem] flex items-end"
          >
            Total Points
          </label>
          <input
            type="number"
            id="totalPoints"
            min={2}
            max={200}
            value={totalPoints}
            onChange={(e) => {
              const val = Math.max(2, Math.min(200, parseInt(e.target.value) || 2))
              const newChargeCount = Math.min(chargeCount, val - 1)
              onChange({ totalPoints: val, chargeCount: newChargeCount })
            }}
            className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg"
          />
          <span className="text-xs text-neutral-400 mt-1 block">
            Points in 20x20 box
          </span>
        </div>

        {/* Charge Count */}
        <div className="flex flex-col">
          <label
            htmlFor="chargeCount"
            className="text-sm uppercase tracking-wider text-neutral-500 mb-2 min-h-[2.5rem] flex items-end"
          >
            Charge Count (P)
          </label>
          <input
            type="number"
            id="chargeCount"
            min={1}
            max={totalPoints - 1}
            value={chargeCount}
            onChange={(e) => {
              const val = Math.max(1, Math.min(totalPoints - 1, parseInt(e.target.value) || 1))
              onChange({ chargeCount: val })
            }}
            className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg"
          />
          <span className="text-xs text-neutral-400 mt-1 block">
            Remaining {Math.max(0, totalPoints - chargeCount)} = pass-through
          </span>
        </div>

        {/* Seed */}
        <div className="flex flex-col">
          <label
            htmlFor="seed"
            className="text-sm uppercase tracking-wider text-neutral-500 mb-2 min-h-[2.5rem] flex items-end"
          >
            Seed
          </label>
          <input
            type="number"
            id="seed"
            value={seed}
            onChange={(e) => onChange({ seed: parseInt(e.target.value) || 0 })}
            className="w-full px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black text-lg"
          />
          <span className="text-xs text-neutral-400 mt-1 block">
            Different seed = different layout
          </span>
        </div>
      </div>

      {/* ── Accuracy (A) ─────────────────────────────────────── */}
      <div>
        <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-3">
          Accuracy (A) — Grid Step Size
        </label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={accuracy === null}
              onChange={(e) =>
                onChange({ accuracy: e.target.checked ? null : 0.1 })
              }
              className="accent-black w-4 h-4"
            />
            <span className="text-sm text-neutral-600">Auto</span>
          </label>
          {accuracy !== null && (
            <div className="flex items-center gap-3 flex-1">
              <input
                type="range"
                min={0.02}
                max={1}
                step={0.02}
                value={accuracy}
                onChange={(e) => onChange({ accuracy: parseFloat(e.target.value) })}
                className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
              />
              <span className="text-sm text-neutral-600 w-12 text-right">
                {accuracy.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Stroke controls ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6">
        {/* Stroke Weight */}
        <div>
          <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
            Stroke Weight
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.005}
              max={0.5}
              step={0.005}
              value={strokeWeight}
              onChange={(e) => onChange({ strokeWeight: parseFloat(e.target.value) })}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <span className="text-sm text-neutral-600 w-14 text-right">
              {strokeWeight.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Stroke Color */}
        <div>
          <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
            Stroke Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => onChange({ strokeColor: e.target.value })}
              className="w-12 h-12 border border-black/20 cursor-pointer bg-white p-1"
            />
            <span className="text-sm text-neutral-600 uppercase">{strokeColor}</span>
          </div>
        </div>
      </div>

      {/* ── Fill controls ───────────────────────────────────── */}
      <div>
        <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-3">
          Fill Isocurve Set (sorted by area, small → large)
        </label>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <input
              type="range"
              min={-1}
              max={maxSetIndex}
              step={1}
              value={fillSetIndex}
              onChange={(e) => onChange({ fillSetIndex: parseInt(e.target.value) })}
              className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            <span className="text-sm text-neutral-600 w-16 text-right">
              {fillSetIndex === -1 ? 'None' : `#${fillSetIndex}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={fillColor}
              onChange={(e) => onChange({ fillColor: e.target.value })}
              className="w-12 h-12 border border-black/20 cursor-pointer bg-white p-1"
              disabled={fillSetIndex === -1}
            />
            <span className="text-sm text-neutral-600 uppercase">{fillColor}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
