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

  // Keep currentOffsetRef in sync with state
  useEffect(() => {
    currentOffsetRef.current = titleOffset
  }, [titleOffset])

  // Gravity animation - smoothly pull title back to initial position
  const startGravity = useCallback(() => {
    if (gravityAnimationRef.current) {
      cancelAnimationFrame(gravityAnimationRef.current)
    }

    setIsGravityActive(true)

    const animate = () => {
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
    setIsGravityActive(false)
  }, [])

  // Handle scroll events
  const handleScroll = useCallback((scrollTop: number) => {
    // Determine scroll direction
    const direction = scrollTop > lastScrollTop.current ? 'down' : 'up'
    scrollDirection.current = direction
    lastScrollTop.current = scrollTop

    // Stop any ongoing gravity animation when user scrolls
    stopGravity()

    // Clear previous scroll stop timer
    if (scrollStopTimer.current) {
      clearTimeout(scrollStopTimer.current)
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
      // User stopped scrolling - apply gravity
      if (currentOffsetRef.current > 0) {
        startGravity()
      }
    }, scrollStopDelay)
  }, [maxOffset, scrollStopDelay, startGravity, stopGravity])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollStopTimer.current) {
        clearTimeout(scrollStopTimer.current)
      }
      if (gravityAnimationRef.current) {
        cancelAnimationFrame(gravityAnimationRef.current)
      }
    }
  }, [])

  return {
    titleOffset,
    handleScroll,
    isGravityActive,
  }
}
