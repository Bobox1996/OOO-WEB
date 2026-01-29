'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppNav from '@/components/AppNav'
import Image from 'next/image'

interface Generation {
  id: string
  prompt: string
  image_url: string
  created_at: string
}

export default function AppPage() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentImage, setCurrentImage] = useState<Generation | null>(null)
  const [recentGenerations, setRecentGenerations] = useState<Generation[]>([])
  const supabase = createClient()

  // Fetch recent generations on mount
  useEffect(() => {
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('app_generations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6)

      if (data) {
        setRecentGenerations(data)
      }
    }
    fetchRecent()
  }, [supabase])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || loading) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image')
      }

      setCurrentImage(data.generation)
      // Add to recent generations
      setRecentGenerations(prev => [data.generation, ...prev.slice(0, 5)])
      setPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AppNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              AI Image
              <br />
              Generator
            </h1>
            <p className="text-neutral-500 mt-4 text-lg">Generate images with Gemini AI</p>
          </div>

          {/* Generator Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            {/* Input Section */}
            <div>
              <form onSubmit={handleGenerate} className="space-y-6">
                <div>
                  <label htmlFor="prompt" className="block text-sm uppercase tracking-wider text-neutral-500 mb-4">
                    Enter your prompt
                  </label>
                  <textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the image you want to generate..."
                    rows={6}
                    className="w-full px-4 py-4 bg-white border border-black/20 text-black placeholder-neutral-400 focus:outline-none focus:border-black text-lg resize-none"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="border border-red-500 bg-red-50 p-4 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="w-full py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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
              </form>
            </div>

            {/* Result Section */}
            <div>
              <p className="block text-sm uppercase tracking-wider text-neutral-500 mb-4">
                Generated Image
              </p>
              <div className="aspect-square bg-neutral-100 border border-black/10 flex items-center justify-center overflow-hidden">
                {currentImage ? (
                  <Image
                    src={currentImage.image_url}
                    alt={currentImage.prompt}
                    width={800}
                    height={800}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center text-neutral-400 p-8">
                    <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm uppercase tracking-wider">
                      Your generated image will appear here
                    </p>
                  </div>
                )}
              </div>
              {currentImage && (
                <p className="mt-4 text-sm text-neutral-500 italic">
                  &quot;{currentImage.prompt}&quot;
                </p>
              )}
            </div>
          </div>

          {/* Recent Generations */}
          {recentGenerations.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold tracking-tight mb-6 uppercase">Recent Generations</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-black/10">
                {recentGenerations.map((gen) => (
                  <button
                    key={gen.id}
                    onClick={() => setCurrentImage(gen)}
                    className="bg-white aspect-square relative group overflow-hidden"
                  >
                    <Image
                      src={gen.image_url}
                      alt={gen.prompt}
                      fill
                      className="object-cover group-hover:opacity-80 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <p className="text-white text-xs line-clamp-3">{gen.prompt}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
