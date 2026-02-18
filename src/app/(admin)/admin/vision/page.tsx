'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/services/supabase/client'
import { getAdminRole } from '@/services/supabase/admin'
import AdminNav from '@/components/layout/AdminNav'
import type { VisionContent } from '@/types'
import type { User } from '@supabase/supabase-js'

export default function AdminVisionPage() {
  const [vision, setVision] = useState<VisionContent | null>(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    
    if (user?.email) {
      const role = await getAdminRole(supabase, user.email)
      if (role === 'super_admin') {
        setHasAccess(true)
        fetchVision()
        return
      }
    }
    setHasAccess(false)
    setLoading(false)
  }

  const fetchVision = async () => {
    const { data } = await supabase
      .from('vision_content')
      .select('*')
      .limit(1)
      .single()

    if (data) {
      setVision(data as VisionContent)
      setContent(data.content || '')
    }
    setLoading(false)
  }

  const saveVision = async () => {
    setSaving(true)
    setSaved(false)

    if (vision) {
      // Update existing record
      const { error } = await supabase
        .from('vision_content')
        .update({
          content,
          updated_at: new Date().toISOString(),
          updated_by: user?.email || null,
        })
        .eq('id', vision.id)

      if (!error) {
        setVision({ ...vision, content, updated_at: new Date().toISOString() })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('vision_content')
        .insert({
          content,
          updated_by: user?.email || null,
        })
        .select()
        .single()

      if (!error && data) {
        setVision(data as VisionContent)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    }

    setSaving(false)
  }

  // Access denied view
  if (!loading && !hasAccess) {
    return (
      <>
        <AdminNav />
        <main className="pt-24 px-6 pb-12">
          <div className="max-w-screen-xl mx-auto">
            <div className="border border-black/10 p-16 text-center">
              <div className="mb-6">
                <svg className="w-16 h-16 mx-auto text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <AdminNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-xl mx-auto">
          {/* Header */}
          <div className="flex items-end justify-between mb-12">
            <div>
              <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
                Vision
              </h1>
              <p className="text-neutral-500 mt-4 text-lg">Edit the vision statement</p>
            </div>
            <div className="flex items-center gap-4">
              {saved && (
                <span className="text-green-600 text-sm uppercase tracking-widest">
                  Saved!
                </span>
              )}
              <button
                onClick={saveVision}
                disabled={saving || loading}
                className="px-6 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="border border-black/10 p-16 text-center">
              <p className="text-neutral-500">Loading...</p>
            </div>
          ) : (
            <div className="border border-black/10">
              {/* Editor */}
              <div className="p-6">
                <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-4">
                  Vision Content
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={15}
                  placeholder="Enter your vision statement here...&#10;&#10;Each line will be displayed centered in the O-field.&#10;Use line breaks to separate paragraphs."
                  className="w-full px-4 py-4 bg-neutral-50 border border-black/20 text-black placeholder-neutral-400 focus:outline-none focus:border-black focus:bg-white resize-none font-mono text-sm leading-relaxed"
                />
                <p className="text-sm text-neutral-400 mt-4">
                  The text will be displayed centered on each line with cyan color in the Vision page.
                  Use line breaks to control how the text is split across lines.
                </p>
              </div>

              {/* Meta info */}
              {vision && (
                <div className="px-6 py-4 border-t border-black/10 bg-neutral-50">
                  <div className="flex items-center justify-between text-sm text-neutral-400">
                    <span>
                      Last updated: {new Date(vision.updated_at).toLocaleString()}
                    </span>
                    {vision.updated_by && (
                      <span>
                        by {vision.updated_by}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview hint */}
          <div className="mt-8 p-6 border border-dashed border-black/20 bg-neutral-50">
            <h3 className="text-sm uppercase tracking-wider text-neutral-500 mb-2">Preview</h3>
            <p className="text-sm text-neutral-400">
              Visit <a href="/vision" target="_blank" className="text-blue-500 hover:underline">/vision</a> to see how your content looks on the public page.
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
