'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import { useRouter } from 'next/navigation'

export default function NewAppUserPage() {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async () => {
    if (!formData.email.trim()) {
      setError('Email is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Add user to app_users whitelist
      const { error: dbError } = await supabase
        .from('app_users')
        .insert({
          email: formData.email.trim().toLowerCase(),
          name: formData.name.trim() || null,
        })

      if (dbError) {
        // If user already in whitelist
        if (dbError.message.includes('duplicate')) {
          throw new Error('This email is already in the APP users list')
        }
        throw dbError
      }

      router.push('/admin/app-users')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AdminNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-md mx-auto">
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
            New APP User
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

          {/* Info Box */}
          <div className="mt-6 p-4 border border-black/10 bg-neutral-50">
            <p className="text-sm text-neutral-500">
              <strong>Important:</strong> After adding the email here, you need to create the user account in the 
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline mx-1">Supabase Dashboard</a>
              (Authentication → Users → Add user). Once the account exists, the user can log in at <code className="bg-white px-1 py-0.5 border border-black/10">/app/login</code>.
            </p>
          </div>

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
              {saving ? 'Adding...' : 'Add User'}
            </button>
            <button
              onClick={() => router.back()}
              className="px-8 py-4 border border-black/30 text-neutral-500 text-sm uppercase tracking-widest hover:border-black hover:text-black transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
