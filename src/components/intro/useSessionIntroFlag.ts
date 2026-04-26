'use client'

import { useCallback, useEffect, useState } from 'react'

const DEFAULT_INTRO_KEY = 'ooo_home_intro_seen'

interface UseSessionIntroFlagResult {
  isReady: boolean
  hasSeen: boolean
  markSeen: () => void
}

export function useSessionIntroFlag(storageKey: string = DEFAULT_INTRO_KEY): UseSessionIntroFlagResult {
  const [isReady, setIsReady] = useState(false)
  const [hasSeen, setHasSeen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const seenValue = window.sessionStorage.getItem(storageKey)
      setHasSeen(seenValue === '1')
    } catch (error) {
      console.warn('Unable to read intro session flag:', error)
      setHasSeen(false)
    } finally {
      setIsReady(true)
    }
  }, [storageKey])

  const markSeen = useCallback(() => {
    if (typeof window === 'undefined') return

    try {
      window.sessionStorage.setItem(storageKey, '1')
    } catch (error) {
      console.warn('Unable to persist intro session flag:', error)
    }
    setHasSeen(true)
  }, [storageKey])

  return { isReady, hasSeen, markSeen }
}
