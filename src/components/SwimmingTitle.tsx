'use client'

import { useRef, useEffect, useState } from 'react'

interface SwimmingTitleProps {
  title: string
}

const MOBILE_BREAKPOINT = 768

export default function SwimmingTitle({ title }: SwimmingTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const targetPosition = useRef({ x: 0, y: 0 })
  const currentPosition = useRef({ x: 0, y: 0 })
  const animationFrame = useRef<number | null>(null)
  
  // Mobile jumping physics refs
  const velocity = useRef(0)
  const jumpPhase = useRef<'grounded' | 'jumping' | 'falling'>('grounded')
  const groundedTime = useRef(0)
  const nextJumpDelay = useRef(0)

  // Mobile detection with resize listener
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // PC: Mouse following effect
  useEffect(() => {
    if (isMobile) return

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
  }, [isMobile])

  // Animation loop
  useEffect(() => {
    if (isMobile) {
      // Mobile: Jumping physics animation
      const gravity = 0.8
      const jumpStrength = -12 // Negative because Y goes up
      const bounceDamping = 0.3
      const minJumpDelay = 300 // ms
      const maxJumpDelay = 800 // ms
      
      let lastTime = performance.now()
      nextJumpDelay.current = Math.random() * (maxJumpDelay - minJumpDelay) + minJumpDelay
      
      const animate = (currentTime: number) => {
        if (!containerRef.current || !titleRef.current) {
          animationFrame.current = requestAnimationFrame(animate)
          return
        }

        const deltaTime = (currentTime - lastTime) / 16 // Normalize to ~60fps
        lastTime = currentTime

        const containerRect = containerRef.current.getBoundingClientRect()
        const titleRect = titleRef.current.getBoundingClientRect()
        
        // Calculate ground position (bottom of container with padding)
        const padding = 16
        const groundY = (containerRect.height - titleRect.height) / 2 - padding

        if (jumpPhase.current === 'grounded') {
          // Sitting on ground, waiting to jump
          groundedTime.current += deltaTime * 16
          
          if (groundedTime.current >= nextJumpDelay.current) {
            // Start jumping!
            jumpPhase.current = 'jumping'
            // Randomize jump strength slightly for organic feel
            const jumpVariation = 0.7 + Math.random() * 0.6 // 0.7 to 1.3
            velocity.current = jumpStrength * jumpVariation
            groundedTime.current = 0
            nextJumpDelay.current = Math.random() * (maxJumpDelay - minJumpDelay) + minJumpDelay
          }
          
          // Stay at ground
          currentPosition.current.y = groundY
        } else {
          // Jumping or falling
          velocity.current += gravity * deltaTime
          currentPosition.current.y += velocity.current * deltaTime
          
          // Check if hit ground
          if (currentPosition.current.y >= groundY) {
            currentPosition.current.y = groundY
            
            // Small bounce effect
            if (Math.abs(velocity.current) > 2) {
              velocity.current = -velocity.current * bounceDamping
              jumpPhase.current = 'falling'
            } else {
              velocity.current = 0
              jumpPhase.current = 'grounded'
            }
          } else if (velocity.current > 0) {
            jumpPhase.current = 'falling'
          }
        }

        // Center X position on mobile
        currentPosition.current.x = 0

        setPosition({
          x: currentPosition.current.x,
          y: currentPosition.current.y,
        })

        animationFrame.current = requestAnimationFrame(animate)
      }

      // Initialize at ground position
      if (containerRef.current && titleRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const titleRect = titleRef.current.getBoundingClientRect()
        const padding = 16
        const groundY = (containerRect.height - titleRect.height) / 2 - padding
        currentPosition.current.y = groundY
        setPosition({ x: 0, y: groundY })
      }

      animationFrame.current = requestAnimationFrame(animate)
    } else {
      // PC: Smooth swimming animation
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
    }
    
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [isMobile, position.x, position.y])

  // Reset position when switching between mobile/desktop
  useEffect(() => {
    if (isMobile) {
      // Reset to grounded state
      jumpPhase.current = 'grounded'
      velocity.current = 0
      groundedTime.current = 0
    } else {
      // Reset to center for PC
      currentPosition.current = { x: 0, y: 0 }
      targetPosition.current = { x: 0, y: 0 }
      setPosition({ x: 0, y: 0 })
    }
  }, [isMobile])

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
