'use client'

import { useState, useEffect, useRef } from 'react'
import { getSavedPalettes, type SavedPalette } from '@/lib/utils/colorPalettes'

interface ColorPalettePickerProps {
  onSelectColor: (hex: string) => void
}

export default function ColorPalettePicker({ onSelectColor }: ColorPalettePickerProps) {
  const [palettes, setPalettes] = useState<SavedPalette[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const reload = () => setPalettes(getSavedPalettes())

  useEffect(() => {
    reload()
    const handler = () => reload()
    window.addEventListener('palettes-updated', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('palettes-updated', handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = palettes.find((p) => p.id === selectedId)

  if (palettes.length === 0) return null

  return (
    <div className="mt-2 space-y-1.5" ref={ref}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 border border-black/10 bg-white text-xs uppercase tracking-widest text-neutral-500 hover:border-black/30 transition-colors cursor-pointer"
        >
          <span className="truncate">
            {selected ? selected.name : '-- Saved Palettes --'}
          </span>
          <svg
            className={`w-3 h-3 flex-shrink-0 ml-1 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-0.5 bg-white border border-black/10 shadow-lg z-50 max-h-40 overflow-y-auto">
            <button
              onClick={() => { setSelectedId(''); setOpen(false) }}
              className="w-full px-2.5 py-1.5 text-left text-xs text-neutral-400 hover:bg-neutral-50 transition-colors"
            >
              -- None --
            </button>
            {palettes.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedId(p.id); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-neutral-50 transition-colors ${
                  p.id === selectedId ? 'bg-neutral-100' : ''
                }`}
              >
                <div className="flex gap-0.5 flex-shrink-0">
                  {p.colors.slice(0, 5).map((c, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 border border-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <span className="text-xs text-neutral-700 truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="flex flex-wrap gap-1">
          {selected.colors.map((color, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelectColor(color)}
              className="w-6 h-6 border border-black/20 hover:scale-110 hover:border-black transition-all cursor-pointer"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      )}
    </div>
  )
}
