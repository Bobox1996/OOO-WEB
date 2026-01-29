'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const SAVED_EMAILS_KEY = 'ooo_app_saved_emails'

export default function AppLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [savedEmails, setSavedEmails] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Check for error from middleware redirect
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'unauthorized') {
      setError('You are not authorized to access this app. Please contact an administrator.')
    } else if (errorParam === 'stopped') {
      setError('Your access has been suspended. Please contact an administrator.')
    }
  }, [searchParams])

  // Load saved emails from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_EMAILS_KEY)
      if (stored) {
        const emails = JSON.parse(stored)
        if (Array.isArray(emails)) {
          setSavedEmails(emails)
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Save email to localStorage on successful login
  const saveEmail = (emailToSave: string) => {
    try {
      const stored = localStorage.getItem(SAVED_EMAILS_KEY)
      let emails: string[] = stored ? JSON.parse(stored) : []
      
      // Remove if already exists (to move it to front)
      emails = emails.filter(e => e.toLowerCase() !== emailToSave.toLowerCase())
      
      // Add to front of array
      emails.unshift(emailToSave)
      
      // Keep only last 5 emails
      emails = emails.slice(0, 5)
      
      localStorage.setItem(SAVED_EMAILS_KEY, JSON.stringify(emails))
    } catch {
      // Ignore localStorage errors
    }
  }

  const handleSelectEmail = (selectedEmail: string) => {
    setEmail(selectedEmail)
    setShowDropdown(false)
    // Focus password field after selecting email
    document.getElementById('password')?.focus()
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Check if user is authorized as app user
    const { data: appUser } = await supabase
      .from('app_users')
      .select('id, stopped')
      .eq('email', email)
      .single()

    if (!appUser) {
      // Sign out the user since they're not authorized
      await supabase.auth.signOut()
      setError('You are not authorized to access this app. Please contact an administrator.')
      setLoading(false)
      return
    }

    if (appUser.stopped) {
      // Sign out the user since their access is suspended
      await supabase.auth.signOut()
      setError('Your access has been suspended. Please contact an administrator.')
      setLoading(false)
      return
    }

    // Save the email on successful login
    saveEmail(email)
    router.push('/app')
    router.refresh()
  }

  // Filter saved emails based on current input
  const filteredEmails = savedEmails.filter(savedEmail =>
    savedEmail.toLowerCase().includes(email.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-black/10">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            OOO
          </Link>
          <Link href="/" className="text-sm uppercase tracking-widest text-neutral-400 hover:text-black transition-opacity">
            ← Back
          </Link>
        </div>
      </header>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-12">
            <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              APP
              <br />
              Login
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="border border-black p-4 text-sm">
                {error}
              </div>
            )}

            <div className="relative">
              <label htmlFor="email" className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
                Email
              </label>
              <input
                ref={inputRef}
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => savedEmails.length > 0 && setShowDropdown(true)}
                required
                autoComplete="off"
                className="w-full px-0 py-3 bg-transparent border-0 border-b border-black text-black placeholder-neutral-400 focus:outline-none focus:border-black text-lg"
                placeholder="user@example.com"
              />
              
              {/* Saved emails dropdown */}
              {showDropdown && filteredEmails.length > 0 && (
                <div 
                  ref={dropdownRef}
                  className="absolute z-10 w-full mt-1 bg-white border border-black/20 shadow-lg"
                >
                  {filteredEmails.map((savedEmail, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelectEmail(savedEmail)}
                      className="w-full px-4 py-3 text-left text-sm hover:bg-neutral-100 transition-colors border-b border-black/5 last:border-b-0 flex items-center gap-3"
                    >
                      <svg 
                        className="w-4 h-4 text-neutral-400" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={1.5} 
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                        />
                      </svg>
                      {savedEmail}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-0 py-3 bg-transparent border-0 border-b border-black text-black placeholder-neutral-400 focus:outline-none focus:border-black text-lg"
                placeholder="••••••••"
              />
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
