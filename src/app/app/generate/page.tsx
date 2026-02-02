'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AppNav from '@/components/AppNav'
import Lightbox from '@/components/Lightbox'
import Image from 'next/image'
import { AppAsset, Image as ImageType } from '@/lib/types'

interface Generation {
  id: string
  prompt: string
  image_url: string
  created_at: string
}

// Convert SVG string to PNG base64 with transparent background (compressed)
const svgToPng = async (svgString: string, width: number = 512, height: number = 512): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Remove white background rect from SVG to keep transparency
    const cleanedSvg = svgString.replace(/<rect[^>]*fill="white"[^>]*\/?>/gi, '')

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Could not get canvas context'))
      return
    }

    canvas.width = width
    canvas.height = height
    // No background fill - keep canvas transparent

    const img = new window.Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height)
      // Use JPEG for smaller file size (0.8 quality)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      // Return just the base64 part without the data:image/...;base64, prefix
      resolve(dataUrl.split(',')[1])
    }
    img.onerror = () => reject(new Error('Failed to load SVG image'))
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(cleanedSvg)))
  })
}

// Convert image URL to compressed base64 using canvas
const urlToBase64 = async (url: string, maxSize: number = 512): Promise<string> => {
  const response = await fetch(url, {
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error('Failed to fetch image')
  }
  const blob = await response.blob()
  
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let width = img.width
      let height = img.height
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        } else {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
      }
      
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      // Use JPEG with 0.8 quality for smaller file size
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      resolve(dataUrl.split(',')[1])
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load image'))
    }
    img.src = URL.createObjectURL(blob)
  })
}

export default function GeneratePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentImages, setCurrentImages] = useState<Generation[]>([])
  const [recentGenerations, setRecentGenerations] = useState<Generation[]>([])
  const [patternSVG, setPatternSVG] = useState<string | null>(null)
  const [packages, setPackages] = useState<AppAsset[]>([])
  const [selectedPackage, setSelectedPackage] = useState<AppAsset | null>(null)
  const [packagesLoading, setPackagesLoading] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const supabase = createClient()

  // Load pattern SVG from localStorage and fetch recent generations on mount
  useEffect(() => {
    // Load pattern from localStorage
    const savedPattern = localStorage.getItem('patternSVG')
    if (savedPattern) {
      try {
        const svgString = decodeURIComponent(escape(atob(savedPattern)))
        setPatternSVG(svgString)
      } catch (e) {
        console.error('Failed to decode pattern SVG:', e)
      }
    }

    // Fetch recent generations
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('app_generations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(12)

      if (data) {
        setRecentGenerations(data)
      }
    }
    fetchRecent()

    // Fetch packages from app_assets where category = 'PACKAGE'
    const fetchPackages = async () => {
      setPackagesLoading(true)
      const { data } = await supabase
        .from('app_assets')
        .select('*')
        .eq('category', 'PACKAGE')
        .order('created_at', { ascending: false })

      if (data) {
        setPackages(data)
      }
      setPackagesLoading(false)
    }
    fetchPackages()
  }, [supabase])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPackage || loading) return

    setLoading(true)
    setError(null)

    try {
      // Fetch latest package data to ensure prompt is up-to-date
      const { data: latestPackage } = await supabase
        .from('app_assets')
        .select('*')
        .eq('id', selectedPackage.id)
        .single()

      const promptToUse = latestPackage?.prompt || selectedPackage.prompt

      let patternImage: string | undefined
      let packageImage: string | undefined

      // Convert SVG to PNG if pattern exists
      if (patternSVG) {
        try {
          patternImage = await svgToPng(patternSVG)
        } catch (e) {
          console.error('Failed to convert SVG to PNG:', e)
        }
      }

      // Convert package image URL to base64
      try {
        packageImage = await urlToBase64(selectedPackage.image_url)
      } catch (e) {
        console.error('Failed to convert package image to base64:', e)
        setError('Failed to load package image')
        setLoading(false)
        return
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: promptToUse,
          patternImage,
          packageImage,
        }),
      })

      // Check content-type before parsing as JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(text || `Server error: ${response.status}`)
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate images')
      }

      setCurrentImages(data.generations)
      // Add both generations to recent generations
      setRecentGenerations((prev) => [...data.generations, ...prev.slice(0, 6)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    router.push('/app')
  }

  const handleClearPattern = () => {
    localStorage.removeItem('patternSVG')
    setPatternSVG(null)
  }

  const handleDownloadPattern = () => {
    if (!patternSVG) return
    const blob = new Blob([patternSVG], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pattern.svg'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadImage = async (e: React.MouseEvent, imageUrl: string, filename: string) => {
    e.stopPropagation()
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDeleteGeneration = async (e: React.MouseEvent, generation: Generation) => {
    e.stopPropagation()
    
    // Extract storage path from image_url
    // URL format: https://xxx.supabase.co/storage/v1/object/public/generations/user_id/timestamp.png
    const urlParts = generation.image_url.split('/generations/')
    const storagePath = urlParts[1] // e.g., "user_id/timestamp.png"
    
    if (storagePath) {
      // Delete from storage
      await supabase.storage.from('generations').remove([storagePath])
    }
    
    // Delete from database
    await supabase.from('app_generations').delete().eq('id', generation.id)
    
    // Update local state
    setRecentGenerations((prev) => prev.filter((g) => g.id !== generation.id))
    setCurrentImages((prev) => prev.filter((g) => g.id !== generation.id))
  }

  return (
    <>
      <AppNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              Package
              <br />
              Viewer
            </h1>
            <p className="text-neutral-500 mt-4 text-lg">Transform patterns into package designs with AI</p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-400 flex items-center justify-center text-sm font-medium">
                1
              </span>
              <span className="text-sm uppercase tracking-wider text-neutral-400">Create Pattern</span>
            </div>
            <div className="h-px bg-neutral-300 flex-1 max-w-24" />
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-sm font-medium">
                2
              </span>
              <span className="text-sm uppercase tracking-wider font-medium">AI Generate</span>
            </div>
          </div>

          {/* Generator Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            {/* Input Section */}
            <div>
              {/* Pattern Preview */}
              {patternSVG && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm uppercase tracking-wider text-neutral-500">
                      Input Pattern
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDownloadPattern}
                        className="text-xs uppercase tracking-wider text-neutral-400 hover:text-black transition-colors"
                      >
                        Download Pattern
                      </button>
                      <button
                        onClick={handleBack}
                        className="text-xs uppercase tracking-wider text-neutral-400 hover:text-black transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleClearPattern}
                        className="text-xs uppercase tracking-wider text-red-400 hover:text-red-600 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div
                    className="aspect-square w-full max-w-xs bg-neutral-100 border border-black/10 overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: patternSVG }}
                  />
                </div>
              )}

              <form onSubmit={handleGenerate} className="space-y-6">
                {/* Package Selector */}
                <div>
                  <p className="block text-sm uppercase tracking-wider text-neutral-500 mb-4">
                    Select a Package
                  </p>
                  
                  {packagesLoading ? (
                    <div className="flex gap-4 overflow-x-auto pb-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="flex-shrink-0 w-32 h-32 bg-neutral-200 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : packages.length === 0 ? (
                    <div className="bg-neutral-100 border border-black/10 p-8 text-center">
                      <p className="text-neutral-500 text-sm">No packages available</p>
                    </div>
                  ) : (
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-neutral-300">
                      {packages.map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setSelectedPackage(pkg)}
                          className={`flex-shrink-0 w-32 h-32 relative overflow-hidden border-2 transition-all ${
                            selectedPackage?.id === pkg.id
                              ? 'border-black ring-2 ring-black ring-offset-2'
                              : 'border-transparent hover:border-neutral-300'
                          }`}
                        >
                          <Image
                            src={pkg.image_url}
                            alt={pkg.prompt}
                            fill
                            className="object-cover"
                          />
                          {selectedPackage?.id === pkg.id && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <svg
                                className="w-8 h-8 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                </div>

                {error && (
                  <div className="border border-red-500 bg-red-50 p-4 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-6 py-4 border border-black/20 text-black text-sm uppercase tracking-widest font-medium hover:bg-neutral-100 transition-colors flex items-center gap-3"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16l-4-4m0 0l4-4m-4 4h18"
                      />
                    </svg>
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !selectedPackage}
                    className="flex-1 py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      'Generate Image'
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Result Section */}
            <div>
              <p className="block text-sm uppercase tracking-wider text-neutral-500 mb-4">
                Generated Images
              </p>
              {currentImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {currentImages.map((img, index) => (
                    <div
                      key={img.id}
                      className="aspect-square bg-neutral-100 border border-black/10 relative group overflow-hidden cursor-pointer"
                      onClick={() => {
                        setLightboxIndex(index)
                        setLightboxOpen(true)
                      }}
                    >
                      <Image
                        src={img.image_url}
                        alt={img.prompt}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-3">
                        <button
                          onClick={(e) => handleDownloadImage(e, img.image_url, `generation-${img.id}.png`)}
                          className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors"
                          title="Download image"
                        >
                          <svg
                            className="w-5 h-5 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="aspect-square bg-neutral-100 border border-black/10 flex items-center justify-center">
                      <div className="text-center text-neutral-400 p-4">
                        <svg
                          className="w-12 h-12 mx-auto mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <p className="text-xs uppercase tracking-wider">
                          Variation {i}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Generations */}
          {recentGenerations.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold tracking-tight mb-6 uppercase">
                Recent Generations
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-black/10">
                {recentGenerations.map((gen) => (
                  <button
                    key={gen.id}
                    onClick={() => setCurrentImages([gen])}
                    className="bg-white aspect-square relative group overflow-hidden"
                  >
                    <Image
                      src={gen.image_url}
                      alt={gen.prompt}
                      fill
                      className="object-cover group-hover:opacity-80 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={(e) => handleDownloadImage(e, gen.image_url, `generation-${gen.id}.png`)}
                          className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors"
                          title="Download image"
                        >
                          <svg
                            className="w-4 h-4 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDeleteGeneration(e, gen)}
                          className="w-8 h-8 bg-red-500/60 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
                          title="Delete image"
                        >
                          <svg
                            className="w-4 h-4 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                      <p className="text-white text-xs line-clamp-3">{gen.prompt}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Lightbox for generated images */}
      {lightboxOpen && currentImages.length > 0 && (
        <Lightbox
          images={currentImages.map((img) => ({
            id: img.id,
            url: img.image_url,
            filename: `generation-${img.id}.png`,
            project_id: '',
            sort_order: 0,
            side_by_side: false,
            created_at: img.created_at,
          } as ImageType))}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onPrev={() => setLightboxIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length)}
          onNext={() => setLightboxIndex((prev) => (prev + 1) % currentImages.length)}
        />
      )}
    </>
  )
}
