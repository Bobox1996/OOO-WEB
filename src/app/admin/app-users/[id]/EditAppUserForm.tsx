'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { AppUser } from '@/lib/types'

interface EditAppUserFormProps {
  user: AppUser
}

export default function EditAppUserForm({ user }: EditAppUserFormProps) {
  const [formData, setFormData] = useState({
    email: user.email,
    name: user.name || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async () => {
    if (!formData.email.trim()) {
      setError('Email is required')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const { error: dbError } = await supabase
        .from('app_users')
        .update({
          email: formData.email.trim().toLowerCase(),
          name: formData.name.trim() || null,
        })
        .eq('id', user.id)

      if (dbError) {
        if (dbError.message.includes('duplicate')) {
          throw new Error('This email is already in the APP users list')
        }
        throw dbError
      }

      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4 mb-12">
        <button
          onClick={() => router.back()}
          className="text-sm uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
        >
          ← Back
        </button>
      </div>

      <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase mb-12">
        Edit User
      </h1>

      {/* Form Fields */}
      <div className="border border-black/10 p-8 space-y-6">
        <div>
          <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
            Email *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-0 py-3 bg-transparent border-0 border-b border-black text-black placeholder-neutral-400 focus:outline-none text-lg"
            placeholder="user@example.com"
          />
          <p className="text-sm text-neutral-400 mt-2">
            Changing the email here only updates the whitelist. The user&apos;s Supabase Auth credentials remain unchanged.
          </p>
        </div>
        <div>
          <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
            Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-0 py-3 bg-transparent border-0 border-b border-black/30 text-black placeholder-neutral-400 focus:outline-none focus:border-black text-lg"
            placeholder="Display name (optional)"
          />
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 p-4 border border-black/10 bg-neutral-50">
        <p className="text-sm text-neutral-500">
          <strong>Added:</strong> {new Date(user.created_at).toLocaleString()}
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="border border-green-500 bg-green-50 p-4 text-sm mt-6 text-green-700">
          User updated successfully
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="border border-black p-4 text-sm mt-6">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 mt-8">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={() => router.back()}
          className="px-8 py-4 border border-black/30 text-neutral-500 text-sm uppercase tracking-widest hover:border-black hover:text-black transition-colors"
        >
          Cancel
        </button>
      </div>
    </>
  )
}
