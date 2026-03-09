'use client'

import React, { useRef } from 'react'

export interface PixelizerParams {
  resolution: number
}

interface PixelizerControlsProps {
  resolution: number
  onChange: (params: Partial<PixelizerParams>) => void
  imagePreview: string | null
  onImageUpload: (file: File) => void
  onImageRemove: () => void
  cols: number
  rows: number
}

export default function PixelizerControls({
  resolution,
  onChange,
  imagePreview,
  onImageUpload,
  onImageRemove,
  cols,
  rows,
}: PixelizerControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onImageUpload(file)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Image Upload */}
      <div>
        <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
          Source Image
        </label>
        {imagePreview ? (
          <div className="space-y-3">
            <div className="relative w-full aspect-video bg-neutral-100 border border-black/10 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Source"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2 text-xs uppercase tracking-wider border border-black/20 hover:bg-neutral-100 transition-colors"
              >
                Replace
              </button>
              <button
                onClick={onImageRemove}
                className="flex-1 py-2 text-xs uppercase tracking-wider border border-red-300 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-8 border-2 border-dashed border-black/20 hover:border-black/40 transition-colors flex flex-col items-center gap-2 text-neutral-500 hover:text-neutral-700"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs uppercase tracking-wider">Upload Image</span>
            <span className="text-xs text-neutral-400">JPG, PNG, WebP</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Resolution */}
      <div>
        <label
          htmlFor="pixelizer-resolution"
          className="block text-sm uppercase tracking-wider text-neutral-500 mb-2"
        >
          Resolution
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            id="pixelizer-resolution"
            min={400}
            max={3000}
            step={1}
            value={resolution}
            onChange={(e) => onChange({ resolution: parseInt(e.target.value) })}
            className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-black"
          />
          <span className="text-sm text-neutral-600 w-14 text-right">{resolution}</span>
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          ~{cols}&times;{rows} grid ({cols * rows} pixels)
        </p>
      </div>
    </div>
  )
}
