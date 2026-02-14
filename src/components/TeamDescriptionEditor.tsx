'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/services/supabase/client'
import type { TeamDescription } from '@/types'

interface TeamDescriptionEditorProps {
  initialDescription: TeamDescription | null
}

export default function TeamDescriptionEditor({ initialDescription }: TeamDescriptionEditorProps) {
  const [description, setDescription] = useState<TeamDescription | null>(initialDescription)
  const [content, setContent] = useState(initialDescription?.content || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  const saveDescription = async () => {
    setSaving(true)
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()

    if (description) {
      // Update existing record
      const { error } = await supabase
        .from('team_description')
        .update({
          content,
          updated_at: new Date().toISOString(),
          updated_by: user?.email || null,
        })
        .eq('id', description.id)

      if (!error) {
        setDescription({ ...description, content, updated_at: new Date().toISOString() })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('team_description')
        .insert({
          content,
          updated_by: user?.email || null,
        })
        .select()
        .single()

      if (!error && data) {
        setDescription(data as TeamDescription)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    }

    setSaving(false)
  }

  return (
    <div className="border border-black/10 mb-12">
      <div className="p-6 border-b border-black/10 bg-neutral-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold uppercase tracking-wider">About This Team</h2>
            <p className="text-sm text-neutral-500 mt-1">This description appears on the Team page</p>
          </div>
          <div className="flex items-center gap-4">
            {saved && (
              <span className="text-green-600 text-sm uppercase tracking-widest">
                Saved!
              </span>
            )}
            <button
              onClick={saveDescription}
              disabled={saving}
              className="px-6 py-2 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
      <div className="p-6">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Enter a description about your team...&#10;&#10;Each line will be displayed in blue text on the Team page."
          className="w-full px-4 py-4 bg-neutral-50 border border-black/20 text-black placeholder-neutral-400 focus:outline-none focus:border-black focus:bg-white resize-none font-mono text-sm leading-relaxed"
        />
        <p className="text-sm text-neutral-400 mt-4">
          The text will be displayed in blue below the team member names.
          Use line breaks to control how the text is split across lines.
        </p>
      </div>
      {description && (
        <div className="px-6 py-4 border-t border-black/10 bg-neutral-50">
          <div className="flex items-center justify-between text-sm text-neutral-400">
            <span>
              Last updated: {new Date(description.updated_at).toLocaleString()}
            </span>
            {description.updated_by && (
              <span>
                by {description.updated_by}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
