'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AppPage() {
  const router = useRouter()

  // Redirect to users by default
  useEffect(() => {
    router.replace('/admin/app/users')
  }, [router])

  return null
}
