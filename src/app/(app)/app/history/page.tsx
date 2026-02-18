'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/services/supabase/client'
import AppNav from '@/components/layout/AppNav'
import Image from 'next/image'

interface Generation {
  id: string
  prompt: string
  image_url: string
  created_at: string
}

export default function HistoryPage() {
  const [generations, setGenerations] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<Generation | null>(null)
  const supabase = createClient()

  // Fetch all generations on mount
  useEffect(() => {
    const fetchGenerations = async () => {
      const { data } = await supabase
        .from('app_generations')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) {
        setGenerations(data)
      }
      setLoading(false)
    }
    fetchGenerations()
  }, [supabase])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this generation?')) return

    // Find the generation to get the image_url
    const generation = generations.find(g => g.id === id)
    if (generation) {
      // Extract storage path from image_url
      const urlParts = generation.image_url.split('/generations/')
      const storagePath = urlParts[1]
      if (storagePath) {
        await supabase.storage.from('generations').remove([storagePath])
      }
    }

    const { error } = await supabase
      .from('app_generations')
      .delete()
      .eq('id', id)

    if (!error) {
      setGenerations(prev => prev.filter(g => g.id !== id))
      if (selectedImage?.id === id) {
        setSelectedImage(null)
      }
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL generations? This cannot be undone.')) return

    // Extract storage paths from all generations
    const storagePaths = generations
      .map(g => {
        const urlParts = g.image_url.split('/generations/')
        return urlParts[1]
      })
      .filter(Boolean) as string[]

    // Batch delete from storage
    if (storagePaths.length > 0) {
      await supabase.storage.from('generations').remove(storagePaths)
    }

    // Delete all from database (RLS ensures only user's own records)
    const ids = generations.map(g => g.id)
    if (ids.length > 0) {
      await supabase
        .from('app_generations')
        .delete()
        .in('id', ids)
    }

    // Clear local state
    setGenerations([])
    setSelectedImage(null)
  }

  return (
    <>
      <AppNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              Generation
              <br />
              History
            </h1>
            <div className="flex items-center gap-4 mt-4">
              <p className="text-neutral-500 text-lg">
                {generations.length} {generations.length === 1 ? 'image' : 'images'} generated
              </p>
              {generations.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  className="px-4 py-2 border border-red-300 text-red-500 text-xs uppercase tracking-widest font-medium hover:bg-red-500 hover:text-white transition-colors"
                >
                  Delete All
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <svg className="animate-spin h-8 w-8 text-neutral-400" viewBox="0 0 24 24">
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
            </div>
          ) : generations.length === 0 ? (
            <div className="border border-black/10 p-16 text-center">
              <p className="text-neutral-500 uppercase tracking-wider text-sm mb-4">No generations yet</p>
              <a
                href="/app/design"
                className="inline-block px-6 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors"
              >
                Generate Your First Image
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Image Grid */}
              <div className="lg:col-span-2">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-black/10">
                  {generations.map((gen) => (
                    <button
                      key={gen.id}
                      onClick={() => setSelectedImage(gen)}
                      className={`bg-white aspect-square relative group overflow-hidden ${
                        selectedImage?.id === gen.id ? 'ring-2 ring-black ring-inset' : ''
                      }`}
                    >
                      <Image
                        src={gen.image_url}
                        alt={gen.prompt}
                        fill
                        className="object-cover group-hover:opacity-80 transition-opacity"
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(gen.id)
                          }}
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
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail Panel */}
              <div className="lg:col-span-1">
                {selectedImage ? (
                  <div className="sticky top-24 space-y-6">
                    <div className="aspect-square bg-neutral-100 border border-black/10 overflow-hidden">
                      <Image
                        src={selectedImage.image_url}
                        alt={selectedImage.prompt}
                        width={600}
                        height={600}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-wider text-neutral-500 mb-2">Prompt</p>
                      <p className="text-lg">{selectedImage.prompt}</p>
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-wider text-neutral-500 mb-2">Created</p>
                      <p className="text-lg">
                        {new Date(selectedImage.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <a
                        href={selectedImage.image_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors text-center"
                      >
                        Download
                      </a>
                      <button
                        onClick={() => handleDelete(selectedImage.id)}
                        className="px-6 py-3 border border-black text-black text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="sticky top-24 border border-black/10 p-8 text-center">
                    <p className="text-neutral-500 uppercase tracking-wider text-sm">
                      Select an image to view details
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
