'use client'

import { useState } from 'react'
import { createClient } from '@/services/supabase/client'
import { useRouter } from 'next/navigation'

interface EditColorThemerConfigFormProps {
  configId: string | null
  initialTemplate: string
}

export default function EditColorThemerConfigForm({
  configId,
  initialTemplate,
}: EditColorThemerConfigFormProps) {
  const [template, setTemplate] = useState(initialTemplate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const formatJson = () => {
    try {
      const parsed = JSON.parse(template)
      setTemplate(JSON.stringify(parsed, null, 2))
      setError(null)
    } catch {
      setError('Invalid JSON — cannot format')
    }
  }

  const handleSubmit = async () => {
    if (!template.trim()) {
      setError('Prompt template is required')
      return
    }

    try {
      JSON.parse(template)
    } catch {
      setError('Invalid JSON format. Please check your template.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      if (configId) {
        const { error: dbError } = await supabase
          .from('app_color_themer_config')
          .update({
            prompt_template: template.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', configId)

        if (dbError) throw dbError
      } else {
        const { error: dbError } = await supabase
          .from('app_color_themer_config')
          .insert({ prompt_template: template.trim() })

        if (dbError) throw dbError
      }

      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-screen-md space-y-8">
      <div className="border border-black/10 p-8 space-y-4">
        <div className="flex items-end justify-between">
          <label className="block text-sm uppercase tracking-wider text-neutral-500">
            Prompt Template (JSON) *
          </label>
          <button
            type="button"
            onClick={formatJson}
            className="text-xs uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
          >
            Format JSON
          </button>
        </div>
        <textarea
          value={template}
          onChange={(e) => {
            setTemplate(e.target.value)
            setSuccess(false)
            setError(null)
          }}
          rows={14}
          spellCheck={false}
          className="w-full px-4 py-4 bg-neutral-900 text-neutral-100 font-mono text-sm border-0 focus:outline-none focus:ring-1 focus:ring-neutral-600 resize-none leading-relaxed"
          placeholder='{"instruction": "Analyze this image and extract the dominant color palette..."}'
        />
        <p className="text-sm text-neutral-400">
          Must be valid JSON. The &quot;instruction&quot; field will be sent to the AI as the prompt text
          alongside the user&apos;s uploaded image.
        </p>
      </div>

      {success && (
        <div className="border border-green-500 bg-green-50 p-4 text-sm text-green-700">
          Config saved successfully
        </div>
      )}

      {error && (
        <div className="border border-black p-4 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  )
}
