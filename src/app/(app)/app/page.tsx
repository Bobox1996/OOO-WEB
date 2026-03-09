'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/services/supabase/client'
import AppNav from '@/components/layout/AppNav'
import { AppPattern, AppMetaballPattern, AppAsawaPattern, AppUserLogo } from '@/types'

type SavedPattern = (AppPattern & { type: 'pattern' }) | (AppMetaballPattern & { type: 'metaball' }) | (AppAsawaPattern & { type: 'ruth-asawa' })

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [logos, setLogos] = useState<AppUserLogo[]>([])
  const [logosLoading, setLogosLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const [savedPatterns, setSavedPatterns] = useState<SavedPattern[]>([])
  const [patternsLoading, setPatternsLoading] = useState(true)

  useEffect(() => {
    const fetchLogos = async () => {
      setLogosLoading(true)
      const { data } = await supabase
        .from('app_user_logos')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setLogos(data)
      setLogosLoading(false)
    }

    const fetchSavedPatterns = async () => {
      setPatternsLoading(true)

      const [{ data: patterns }, { data: metaballs }, { data: asawas }] = await Promise.all([
        supabase
          .from('app_patterns')
          .select('*')
          .eq('pinned', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('app_metaball_patterns')
          .select('*')
          .eq('pinned', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('app_asawa_patterns')
          .select('*')
          .eq('pinned', true)
          .order('created_at', { ascending: false }),
      ])

      const merged: SavedPattern[] = [
        ...(patterns || []).map((p: AppPattern) => ({ ...p, type: 'pattern' as const })),
        ...(metaballs || []).map((p: AppMetaballPattern) => ({ ...p, type: 'metaball' as const })),
        ...(asawas || []).map((p: AppAsawaPattern) => ({ ...p, type: 'ruth-asawa' as const })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setSavedPatterns(merged)
      setPatternsLoading(false)
    }

    fetchLogos()
    fetchSavedPatterns()
  }, [supabase])

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'image/svg+xml' && !file.name.endsWith('.svg')) {
      alert('Please upload an SVG file.')
      return
    }

    setUploading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setUploading(false); return }

    const timestamp = Date.now()
    const storagePath = `${userData.user.id}/${timestamp}-${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('user-logos')
      .upload(storagePath, file, { contentType: 'image/svg+xml' })

    if (uploadError) {
      console.error('Upload failed:', uploadError)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('user-logos')
      .getPublicUrl(storagePath)

    const { data: inserted, error: insertError } = await supabase
      .from('app_user_logos')
      .insert({
        user_id: userData.user.id,
        image_url: urlData.publicUrl,
        filename: file.name,
      })
      .select()
      .single()

    if (!insertError && inserted) {
      setLogos((prev) => [inserted, ...prev])
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDeleteLogo = async (logo: AppUserLogo) => {
    if (!confirm('Delete this logo?')) return

    const urlParts = logo.image_url.split('/user-logos/')
    const storagePath = urlParts[1]
    if (storagePath) {
      await supabase.storage.from('user-logos').remove([storagePath])
    }

    await supabase.from('app_user_logos').delete().eq('id', logo.id)
    setLogos((prev) => prev.filter((l) => l.id !== logo.id))
  }

  const handleLoadPattern = (pattern: SavedPattern) => {
    if (pattern.type === 'pattern') {
      const params = new URLSearchParams({
        columns: String(pattern.columns),
        rows: String(pattern.rows),
        strokeWeight: String(pattern.stroke_weight),
        strokeColor: pattern.stroke_color,
        slogan: pattern.slogan || '',
        sloganWeight: String(pattern.slogan_weight || 400),
        sloganColor: pattern.slogan_color || '#000000',
      })
      router.push(`/app/pattern?${params.toString()}`)
    } else if (pattern.type === 'metaball') {
      const params = new URLSearchParams({
        totalPoints: String(pattern.total_points),
        chargeCount: String(pattern.charge_count),
        seed: String(pattern.seed),
        accuracy: String(pattern.accuracy),
        strokeWeight: String(pattern.stroke_weight),
        strokeColor: pattern.stroke_color,
      })
      router.push(`/app/metaball?${params.toString()}`)
    } else {
      const params = new URLSearchParams({
        columns: String(pattern.columns),
        rows: String(pattern.rows),
        strokeWeight: String(pattern.stroke_weight),
        strokeColor: pattern.stroke_color,
        rotationRandom: String(pattern.rotation_random),
        positionRandom: String(pattern.position_random),
        randomSeed: String(pattern.random_seed),
      })
      router.push(`/app/ruth-asawa?${params.toString()}`)
    }
  }

  const handleUnpinPattern = async (pattern: SavedPattern) => {
    const tableMap = {
      'pattern': 'app_patterns',
      'metaball': 'app_metaball_patterns',
      'ruth-asawa': 'app_asawa_patterns',
    } as const
    const table = tableMap[pattern.type]
    await supabase.from(table).update({ pinned: false }).eq('id', pattern.id)
    setSavedPatterns((prev) => prev.filter((p) => p.id !== pattern.id))
  }

  return (
    <>
      <AppNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="mb-16">
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              Dashboard
            </h1>
            <p className="text-neutral-500 mt-4 text-lg">
              Manage your assets and start designing
            </p>
          </div>

          {/* MY ASSETS Section */}
          <section className="mb-20">
            <h2 className="text-xl font-semibold tracking-tight mb-8 uppercase">
              My Assets
            </h2>

            {/* Logo Gallery */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm uppercase tracking-wider text-neutral-500">
                  Logos
                </p>
                <label className="px-4 py-2 text-xs uppercase tracking-wider border border-black/20 hover:bg-neutral-100 transition-colors cursor-pointer flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {uploading ? 'Uploading...' : 'Upload SVG'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={handleUploadLogo}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>

              {logosLoading ? (
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex-shrink-0 w-28 h-28 bg-neutral-200 animate-pulse" />
                  ))}
                </div>
              ) : logos.length === 0 ? (
                <div className="bg-neutral-50 border border-dashed border-neutral-300 p-12 text-center">
                  <svg className="w-10 h-10 mx-auto mb-3 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-neutral-400 text-sm">No logos uploaded yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                  {logos.map((logo) => (
                    <div key={logo.id} className="relative group aspect-square bg-neutral-100 border border-black/10 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logo.image_url}
                        alt={logo.filename}
                        className="absolute inset-0 w-full h-full object-contain p-2"
                      />
                      <button
                        onClick={() => handleDeleteLogo(logo)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-neutral-400 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <p className="absolute bottom-0 left-0 right-0 bg-white/80 text-[10px] text-neutral-500 px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {logo.filename}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Patterns */}
            <div>
              <p className="text-sm uppercase tracking-wider text-neutral-500 mb-4">
                Saved Patterns
              </p>

              {patternsLoading ? (
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex-shrink-0 w-28 h-28 bg-neutral-200 animate-pulse" />
                  ))}
                </div>
              ) : savedPatterns.length === 0 ? (
                <div className="bg-neutral-50 border border-dashed border-neutral-300 p-12 text-center">
                  <svg className="w-10 h-10 mx-auto mb-3 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <p className="text-neutral-400 text-sm">No saved patterns yet. Save patterns from the Package Viewer.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                  {savedPatterns.map((pattern) => (
                    <div key={pattern.id} className="relative group">
                      <button
                        onClick={() => handleLoadPattern(pattern)}
                        className="w-full aspect-square bg-white border border-black/10 overflow-hidden hover:border-black transition-colors"
                        title="Load pattern in editor"
                      >
                        <div
                          className="w-full h-full"
                          dangerouslySetInnerHTML={{
                            __html: decodeURIComponent(escape(atob(pattern.svg_preview))),
                          }}
                        />
                      </button>
                      <span className="absolute bottom-1 left-1 text-[9px] uppercase tracking-wider bg-black/60 text-white px-1.5 py-0.5 rounded">
                        {pattern.type === 'pattern' ? 'Lattice' : pattern.type === 'metaball' ? 'Metaball' : 'Asawa'}
                      </span>
                      <button
                        onClick={() => handleUnpinPattern(pattern)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-neutral-400 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove from saved"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* QUICK START Section */}
          <section>
            <h2 className="text-xl font-semibold tracking-tight mb-8 uppercase">
              Quick Start
            </h2>
            <button
              onClick={() => router.push('/app/design')}
              className="group w-full border border-black/10 hover:border-black transition-all text-left"
            >
              <div className="flex items-center gap-8 p-8">
                <div className="w-16 h-16 bg-black text-white flex items-center justify-center flex-shrink-0">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold uppercase tracking-wider mb-1">
                    New Design
                  </h3>
                  <p className="text-sm text-neutral-500">
                    Select a design model and create patterns for AI package generation
                  </p>
                </div>
                <svg className="w-6 h-6 text-neutral-300 group-hover:text-black transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </button>
          </section>
        </div>
      </main>
    </>
  )
}
