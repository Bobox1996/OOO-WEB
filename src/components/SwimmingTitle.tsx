'use client'

import { useRef, useEffect, useState } from 'react'

interface SwimmingTitleProps {
  title: string
}

export default function SwimmingTitle({ title }: SwimmingTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const targetPosition = useRef({ x: 0, y: 0 })
  const currentPosition = useRef({ x: 0, y: 0 })
  const animationFrame = useRef<number | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !titleRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const titleRect = titleRef.current.getBoundingClientRect()

      // Calculate cursor position relative to container center
      const containerCenterX = containerRect.left + containerRect.width / 2
      const containerCenterY = containerRect.top + containerRect.height / 2

      // Calculate direction from container center to cursor
      const deltaX = e.clientX - containerCenterX
      const deltaY = e.clientY - containerCenterY

      // Normalize and scale the movement (title moves towards cursor)
      // Max movement is constrained by container size minus title size and padding
      const padding = 16
      const maxX = (containerRect.width - titleRect.width) / 2 - padding
      const maxY = (containerRect.height - titleRect.height) / 2 - padding

      // Calculate target position based on cursor direction
      // The closer the cursor, the more the title moves towards it
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      const maxDistance = Math.sqrt(
        window.innerWidth * window.innerWidth + window.innerHeight * window.innerHeight
      ) / 2

      // Attraction strength based on distance (closer = stronger pull)
      const attraction = Math.max(0, 1 - distance / maxDistance)

      // Target position (normalized to container bounds)
      const normalizedX = (deltaX / (containerRect.width / 2)) * maxX * attraction
      const normalizedY = (deltaY / (containerRect.height / 2)) * maxY * attraction

      // Clamp to bounds
      targetPosition.current = {
        x: Math.max(-maxX, Math.min(maxX, normalizedX)),
        y: Math.max(-maxY, Math.min(maxY, normalizedY)),
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Animation loop for smooth swimming effect
  useEffect(() => {
    const animate = () => {
      // Easing factor for smooth "swimming" motion
      const easing = 0.08

      // Interpolate towards target
      currentPosition.current.x += (targetPosition.current.x - currentPosition.current.x) * easing
      currentPosition.current.y += (targetPosition.current.y - currentPosition.current.y) * easing

      // Only update state if position changed significantly (optimization)
      const dx = Math.abs(currentPosition.current.x - position.x)
      const dy = Math.abs(currentPosition.current.y - position.y)
      
      if (dx > 0.1 || dy > 0.1) {
        setPosition({
          x: currentPosition.current.x,
          y: currentPosition.current.y,
        })
      }

      animationFrame.current = requestAnimationFrame(animate)
    }

    animationFrame.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [position.x, position.y])

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
    >
      <h3
        ref={titleRef}
        className="text-[clamp(1rem,3.33vw,2.67rem)] font-bold leading-[0.9] tracking-tighter uppercase text-white whitespace-nowrap"
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px)`,
          willChange: 'transform',
        }}
      >
        {title}
      </h3>
    </div>
  )
}
