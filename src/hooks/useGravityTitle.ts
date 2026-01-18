'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface UseGravityTitleOptions {
  maxOffset: number
  gravitySpeed?: number  // pixels per frame to pull back (default: 2)
  scrollStopDelay?: number  // ms to wait before applying gravity (default: 150)
}

interface UseGravityTitleReturn {
  titleOffset: number
  handleScroll: (scrollTop: number) => void
  isGravityActive: boolean
}

export function useGravityTitle({
  maxOffset,
  gravitySpeed = 2,
  scrollStopDelay = 150,
}: UseGravityTitleOptions): UseGravityTitleReturn {
  const [titleOffset, setTitleOffset] = useState(0)
  const [isGravityActive, setIsGravityActive] = useState(false)
  
  const lastScrollTop = useRef(0)
  const scrollDirection = useRef<'down' | 'up' | 'none'>('none')
  const scrollStopTimer = useRef<NodeJS.Timeout | null>(null)
  const gravityAnimationRef = useRef<number | null>(null)
  const currentOffsetRef = useRef(0)
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)

  // Keep currentOffsetRef in sync with state
  useEffect(() => {
    currentOffsetRef.current = titleOffset
  }, [titleOffset])

  // Set mounted flag
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Gravity animation - smoothly pull title back to initial position
  const startGravity = useCallback(() => {
    // Cancel any existing animation first
    if (gravityAnimationRef.current) {
      cancelAnimationFrame(gravityAnimationRef.current)
      gravityAnimationRef.current = null
    }

    // Don't start if unmounted
    if (!isMountedRef.current) return

    setIsGravityActive(true)

    const animate = () => {
      // Stop if component unmounted
      if (!isMountedRef.current) {
        gravityAnimationRef.current = null
        return
      }

      const current = currentOffsetRef.current
      
      if (current <= 0) {
        setTitleOffset(0)
        setIsGravityActive(false)
        gravityAnimationRef.current = null
        return
      }

      // Apply gravity - move towards 0
      const newOffset = Math.max(0, current - gravitySpeed)
      setTitleOffset(newOffset)
      currentOffsetRef.current = newOffset

      gravityAnimationRef.current = requestAnimationFrame(animate)
    }

    gravityAnimationRef.current = requestAnimationFrame(animate)
  }, [gravitySpeed])

  // Stop gravity animation
  const stopGravity = useCallback(() => {
    if (gravityAnimationRef.current) {
      cancelAnimationFrame(gravityAnimationRef.current)
      gravityAnimationRef.current = null
    }
    if (isMountedRef.current) {
      setIsGravityActive(false)
    }
  }, [])

  // Handle scroll events
  const handleScroll = useCallback((scrollTop: number) => {
    // Don't process if unmounted
    if (!isMountedRef.current) return

    // Determine scroll direction
    const direction = scrollTop > lastScrollTop.current ? 'down' : 'up'
    scrollDirection.current = direction
    lastScrollTop.current = scrollTop

    // Stop any ongoing gravity animation when user scrolls
    stopGravity()

    // Clear previous scroll stop timer
    if (scrollStopTimer.current) {
      clearTimeout(scrollStopTimer.current)
      scrollStopTimer.current = null
    }

    if (direction === 'down') {
      // Scrolling down - move title up, clamped to maxOffset
      const offset = Math.min(scrollTop, maxOffset)
      setTitleOffset(offset)
    } else {
      // Scrolling up - immediately start gravity to pull title back
      startGravity()
    }

    // Set timer to detect scroll stop
    scrollStopTimer.current = setTimeout(() => {
      // User stopped scrolling - apply gravity if still mounted
      if (isMountedRef.current && currentOffsetRef.current > 0) {
        startGravity()
      }
    }, scrollStopDelay)
  }, [maxOffset, scrollStopDelay, startGravity, stopGravity])

  // Cleanup on unmount - comprehensive cleanup of all timers and animations
  useEffect(() => {
    return () => {
      // Mark as unmounted first
      isMountedRef.current = false
      
      // Clear scroll stop timer
      if (scrollStopTimer.current) {
        clearTimeout(scrollStopTimer.current)
        scrollStopTimer.current = null
      }
      
      // Cancel gravity animation
      if (gravityAnimationRef.current) {
        cancelAnimationFrame(gravityAnimationRef.current)
        gravityAnimationRef.current = null
      }
    }
  }, [])

  return {
    titleOffset,
    handleScroll,
    isGravityActive,
  }
}
