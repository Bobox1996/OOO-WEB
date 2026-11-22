'use client'

import { createBrowserClient } from '@supabase/ssr'

/** Uses the same OOO project and browser session as the website. */
export function getOooSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for this OOO environment.')
  }
  return createBrowserClient(url, key)
}

/** Call a published OOO website API from a client component. */
export async function getOooJson<T>(route: `/api/${string}`): Promise<T> {
  const url = new URL(route, window.location.origin)
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
    throw new Error('Expected an OOO API path under /api/.')
  }
  const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`OOO API request failed (${response.status})`)
  return response.json() as Promise<T>
}
