'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AppNav from '@/components/layout/AppNav'
import { createClient } from '@/services/supabase/client'
import { extractThemeColors, type PaletteColor } from '@/lib/utils/extractThemeColors'

export default function ColorThemerPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [allColors, setAllColors] = useState<PaletteColor[]>([])
  const [targetCount, setTargetCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const [location, setLocation] = useState('')
  const [season, setSeason] = useState('spring')
  const [time, setTime] = useState('early morning')
  const [environment, setEnvironment] = useState('natural')
  const [keyElements, setKeyElements] = useState('')
  const [saturation, setSaturation] = useState('medium')
  const [generating, setGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<[string, string] | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [promptTemplate, setPromptTemplate] = useState<string | null>(null)

  const colors = useMemo(() => allColors.slice(0, targetCount), [allColors, targetCount])

  const finalPrompt = useMemo(() => {
    if (!promptTemplate) return null
    try {
      const parsed = JSON.parse(promptTemplate)

      // First pass: substitute user inputs throughout the entire JSON
      let fullJson = JSON.stringify(parsed, null, 2)
        .replace(/\{location\}/g, location || '')
        .replace(/\{season\}/g, season)
        .replace(/\{time\}/g, time)
        .replace(/\{environment\}/g, environment)
        .replace(/\{keyElements\}/g, keyElements ? `${keyElements}, ${saturation} saturation` : `${saturation} saturation`)

      // Second pass: resolve {themeImagePrompt} self-reference
      const withInputs = JSON.parse(fullJson)
      if (withInputs.themeImagePrompt) {
        fullJson = fullJson.replace(/\{themeImagePrompt\}/g, withInputs.themeImagePrompt)
      }

      return fullJson
    } catch {
      return null
    }
  }, [promptTemplate, location, season, time, environment, keyElements, saturation])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('app_color_themer_config')
      .select('prompt_template')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (!data) return
        setPromptTemplate(data.prompt_template)
      })
  }, [])

  const runExtraction = useCallback(async (src: File) => {
    setLoading(true)
    setError(null)
    try {
      const result = await extractThemeColors(src, { targetCount: 6 })
      const arr = [...result.colors]
      if (arr.length >= 6) {
        const tmp = arr[3]
        arr[3] = arr[5]
        arr[5] = tmp
      }
      setAllColors(arr)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract colors')
      setAllColors([])
    } finally {
      setLoading(false)
    }
  }, [])

  const processFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, or WebP)')
      return
    }

    if (f.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB')
      return
    }

    setError(null)
    setAllColors([])
    setFile(f)

    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(f)
  }, [])

  useEffect(() => {
    if (!file) return
    runExtraction(file)
  }, [file, runExtraction])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) processFile(selected)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) processFile(dropped)
  }

  const handleCopy = (hex: string, index: number) => {
    navigator.clipboard.writeText(hex)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 1500)
  }

  const handleRemoveImage = () => {
    setImagePreview(null)
    setFile(null)
    setAllColors([])
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleGenerate = async () => {
    if (!location.trim() || !keyElements.trim()) {
      setGenError('Location and Key Elements are required')
      return
    }

    setGenerating(true)
    setGenError(null)
    setGeneratedImages(null)

    try {
      const res = await fetch('/api/color-themer/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, season, time, environment, keyElements: `${keyElements}, ${saturation} saturation` }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate images')
      }

      setGeneratedImages(data.images as [string, string])
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const handleSelectGenerated = async (base64: string) => {
    setError(null)
    setAllColors([])
    setGeneratedImages(null)

    const dataUrl = `data:image/png;base64,${base64}`
    setImagePreview(dataUrl)

    const blob = await fetch(dataUrl).then(r => r.blob())
    const f = new File([blob], 'generated.png', { type: 'image/png' })
    setFile(f)
  }

  const selectClass = 'w-full px-3 py-2.5 border border-black/10 bg-white text-sm focus:outline-none focus:border-black transition-colors appearance-none cursor-pointer'

  return (
    <>
      <AppNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          <div className="mb-8">
            <button
              onClick={() => router.push('/app/design')}
              className="text-sm uppercase tracking-widest text-neutral-400 hover:text-black transition-colors mb-6 block"
            >
              &larr; Back to Design Models
            </button>
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              Color
              <br />
              Themer
            </h1>
            <p className="text-neutral-500 mt-4 text-lg">
              Generate a scene or upload an image to extract a color palette
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: AI Generation + Upload */}
            <div className="space-y-6">

              {/* AI Scene Generation */}
              <div className="space-y-4">
                <h2 className="text-sm uppercase tracking-widest font-medium">
                  Generate Theme Image
                </h2>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Tokyo, Swiss Alps, Sahara Desert"
                      className="w-full px-3 py-2.5 border border-black/10 text-sm focus:outline-none focus:border-black transition-colors placeholder:text-neutral-300"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-1">
                        Season
                      </label>
                      <select
                        value={season}
                        onChange={(e) => setSeason(e.target.value)}
                        className={selectClass}
                      >
                        <option value="spring">Spring</option>
                        <option value="summer">Summer</option>
                        <option value="fall">Fall</option>
                        <option value="winter">Winter</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-1">
                        Time
                      </label>
                      <select
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className={selectClass}
                      >
                        <option value="early morning">Early Morning</option>
                        <option value="foggy dawn">Foggy Dawn</option>
                        <option value="sunny afternoon">Sunny Afternoon</option>
                        <option value="dusk">Dusk</option>
                        <option value="night">Night</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-1">
                        Environment
                      </label>
                      <select
                        value={environment}
                        onChange={(e) => setEnvironment(e.target.value)}
                        className={selectClass}
                      >
                        <option value="natural">Natural</option>
                        <option value="urban">Urban</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-1">
                      Key Elements
                    </label>
                    <input
                      type="text"
                      value={keyElements}
                      onChange={(e) => setKeyElements(e.target.value)}
                      placeholder="e.g. cherry blossoms, neon lights, ocean waves"
                      className="w-full px-3 py-2.5 border border-black/10 text-sm focus:outline-none focus:border-black transition-colors placeholder:text-neutral-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-neutral-500 mb-1">
                      Saturation
                    </label>
                    <select
                      value={saturation}
                      onChange={(e) => setSaturation(e.target.value)}
                      className={selectClass}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={generating || !location.trim() || !keyElements.trim()}
                  className="w-full py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {generating ? 'Generating...' : 'Generate Theme Images'}
                </button>

                {genError && (
                  <div className="border border-black p-4 text-sm">
                    {genError}
                  </div>
                )}

                {generating && (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-neutral-400">Generating two theme images...</p>
                    </div>
                  </div>
                )}

                {generatedImages && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-neutral-500">
                      Select one to extract colors
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {generatedImages.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectGenerated(img)}
                          className="group relative aspect-square border border-black/10 overflow-hidden bg-neutral-100 hover:border-black transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:image/png;base64,${img}`}
                            alt={`Generated variation ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                            <span className="px-3 py-1.5 bg-white text-xs uppercase tracking-widest font-medium">
                              Use This
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 border-t border-black/10" />
                <span className="text-xs uppercase tracking-widest text-neutral-400">or</span>
                <div className="flex-1 border-t border-black/10" />
              </div>

              {/* Source Image Upload */}
              <div className="space-y-4">
                <h2 className="text-sm uppercase tracking-widest font-medium">
                  Source Image
                </h2>

                {!imagePreview ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`aspect-square border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center gap-4 ${
                      dragOver
                        ? 'border-black bg-neutral-50'
                        : 'border-neutral-300 hover:border-black'
                    }`}
                  >
                    <svg className="w-12 h-12 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="text-center">
                      <p className="text-sm font-medium">Drop an image here</p>
                      <p className="text-xs text-neutral-400 mt-1">or click to browse (JPG, PNG, WebP)</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="aspect-square border border-black/10 overflow-hidden bg-neutral-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Uploaded image"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      onClick={handleRemoveImage}
                      className="absolute top-3 right-3 w-8 h-8 bg-white border border-black/10 flex items-center justify-center hover:bg-neutral-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Final Prompt Preview (hidden) */}

              {error && (
                <div className="border border-black p-4 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Right: Color Palette Result */}
            <div className="space-y-6">
              <h2 className="text-sm uppercase tracking-widest font-medium">
                Color Palette
              </h2>

              {/* Slider: target color count */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="target-count" className="text-xs uppercase tracking-widest text-neutral-500">
                    Theme Colors
                  </label>
                  <span className="text-sm font-mono font-medium">{targetCount}</span>
                </div>
                <input
                  id="target-count"
                  type="range"
                  min={1}
                  max={6}
                  step={1}
                  value={targetCount}
                  onChange={(e) => setTargetCount(Number(e.target.value))}
                  className="w-full accent-black"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                  <span>6</span>
                </div>
              </div>

              {loading ? (
                <div className="aspect-square border border-black/10 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-neutral-400">Extracting colors...</p>
                  </div>
                </div>
              ) : colors.length > 0 ? (
                <div className="space-y-4">
                  {/* Ratio bar */}
                  <div className="flex flex-col h-80 border border-black/10 overflow-hidden">
                    {(() => {
                      const total = colors.reduce((s, c) => s + c.ratio, 0) || 1
                      return colors.map((color, i) => (
                        <button
                          key={i}
                          onClick={() => handleCopy(color.hex, i)}
                          className="group relative w-full transition-colors"
                          style={{ flex: `${color.ratio / total}`, backgroundColor: color.hex }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                            <span className="px-2 py-1 bg-white text-xs font-mono tracking-wider">
                              {copiedIndex === i ? 'COPIED' : color.hex}
                            </span>
                          </div>
                        </button>
                      ))
                    })()}
                  </div>

                  {/* Color list */}
                  <div className="border border-black/10 divide-y divide-black/10">
                    {colors.map((color, i) => (
                      <button
                        key={i}
                        onClick={() => handleCopy(color.hex, i)}
                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-neutral-50 transition-colors text-left"
                      >
                        <div
                          className="w-6 h-6 border border-black/10 flex-shrink-0"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="font-mono text-sm tracking-wider flex-1">
                          {color.hex}
                        </span>
                        <span className="text-xs text-neutral-400 uppercase tracking-widest">
                          {copiedIndex === i ? 'Copied!' : 'Click to copy'}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Copy All */}
                  <button
                    onClick={() => {
                      const hexes = colors.map(c => c.hex)
                      navigator.clipboard.writeText(JSON.stringify(hexes, null, 2))
                      setCopiedIndex(-1)
                      setTimeout(() => setCopiedIndex(null), 1500)
                    }}
                    className="w-full py-3 border border-black/10 text-sm uppercase tracking-widest hover:border-black transition-colors"
                  >
                    {copiedIndex === -1 ? 'Copied All!' : 'Copy All as JSON'}
                  </button>
                </div>
              ) : (
                <div className="aspect-square border border-dashed border-neutral-300 flex flex-col items-center justify-center gap-3 text-neutral-300">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <p className="text-sm text-neutral-400">
                    Upload an image to extract its color palette
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
