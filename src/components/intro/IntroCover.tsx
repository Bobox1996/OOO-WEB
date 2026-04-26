'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

const BASE_RING_RADII = [0.72, 0.9, 1.08]
const RING_PHASE_OFFSETS = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]

interface IntroCoverProps {
  durationMs?: number
  fadeDurationMs?: number
  particleCount?: number
  onComplete: () => void
}

export default function IntroCover({
  durationMs = 2500,
  fadeDurationMs = 650,
  particleCount = 6000,
  onComplete,
}: IntroCoverProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const resizeHandlerRef = useRef<(() => void) | null>(null)
  const unlockTimerRef = useRef<number | null>(null)
  const [canEnter, setCanEnter] = useState(false)
  const [isFadingOut, setIsFadingOut] = useState(false)

  const hintText = useMemo(
    () => (canEnter ? 'Click anywhere to enter' : 'Loading OOO...'),
    [canEnter]
  )

  useEffect(() => {
    unlockTimerRef.current = window.setTimeout(() => setCanEnter(true), durationMs)

    return () => {
      if (unlockTimerRef.current) {
        window.clearTimeout(unlockTimerRef.current)
      }
    }
  }, [durationMs])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xffffff)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 0, 4.6)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rendererRef.current = renderer
    mount.appendChild(renderer.domElement)

    const positions = new Float32Array(particleCount * 3)
    const randomSeeds = new Float32Array(particleCount)
    const ringIndices = new Uint8Array(particleCount)
    const angleBases = new Float32Array(particleCount)
    const radialOffsets = new Float32Array(particleCount)
    const zOffsets = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i += 1) {
      const i3 = i * 3
      const ringIndex = i % 3

      positions[i3] = (Math.random() * 2 - 1) * 2.8
      positions[i3 + 1] = (Math.random() * 2 - 1) * 2.6
      positions[i3 + 2] = (Math.random() * 2 - 1) * 2.4

      ringIndices[i] = ringIndex
      randomSeeds[i] = Math.random()
      angleBases[i] = Math.random() * Math.PI * 2
      radialOffsets[i] = (Math.random() * 2 - 1) * 0.09
      zOffsets[i] = (Math.random() * 2 - 1) * 0.12
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({
      color: 0x111111,
      size: 0.012,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    const start = performance.now()

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight || window.innerHeight
      renderer.setSize(width, height)
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
    }

    resize()
    resizeHandlerRef.current = resize
    window.addEventListener('resize', resize)

    const animate = (now: number) => {
      const elapsed = (now - start) / 1000
      const convergeProgress = Math.min(elapsed / (durationMs / 1000), 1)
      const convergenceEase = 1 - Math.pow(1 - convergeProgress, 3)
      const pulse = 0.035 * Math.sin(elapsed * 0.85)

      for (let i = 0; i < particleCount; i += 1) {
        const i3 = i * 3
        const ringIndex = ringIndices[i]
        const ringPhase = RING_PHASE_OFFSETS[ringIndex]
        const noiseSeed = randomSeeds[i]
        const baseAngle = angleBases[i]

        const angle =
          baseAngle +
          elapsed * (0.24 + ringIndex * 0.08) +
          Math.sin(elapsed * 0.55 + baseAngle * 2.3 + noiseSeed * 6.2) * 0.24

        const irregularity =
          Math.sin(angle * 2.2 + elapsed * 0.9 + noiseSeed * 5.1) * 0.07 +
          Math.cos(angle * 3.5 - elapsed * 0.65 + noiseSeed * 4.7) * 0.045

        const radius = BASE_RING_RADII[ringIndex] + radialOffsets[i] + irregularity + pulse

        const orbitOffsetX = Math.sin(elapsed * (0.6 + ringIndex * 0.14) + ringPhase) * 0.24
        const orbitOffsetY = Math.cos(elapsed * (0.5 + ringIndex * 0.12) + ringPhase) * 0.18
        const orbitOffsetZ = Math.sin(elapsed * (0.72 + ringIndex * 0.13) + ringPhase) * 0.2

        const targetX = Math.cos(angle) * radius + orbitOffsetX
        const targetY = Math.sin(angle) * radius * (0.88 + ringIndex * 0.07) + orbitOffsetY
        const targetZ =
          zOffsets[i] +
          Math.sin(angle * 1.45 + elapsed * (0.7 + ringIndex * 0.15) + noiseSeed * 3.4) * 0.13 +
          orbitOffsetZ

        const blend = 0.03 + convergenceEase * 0.18
        positions[i3] += (targetX - positions[i3]) * blend
        positions[i3 + 1] += (targetY - positions[i3 + 1]) * blend
        positions[i3 + 2] += (targetZ - positions[i3 + 2]) * blend
      }

      geometry.attributes.position.needsUpdate = true

      points.rotation.x = Math.sin(elapsed * 0.35) * 0.2
      points.rotation.y = Math.cos(elapsed * 0.28) * 0.28

      renderer.render(scene, camera)
      rafRef.current = window.requestAnimationFrame(animate)
    }

    rafRef.current = window.requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current)
      }
      scene.remove(points)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
      rendererRef.current = null
    }
  }, [durationMs, particleCount])

  const handleClick = () => {
    if (!canEnter || isFadingOut) return
    setIsFadingOut(true)
    window.setTimeout(() => onComplete(), fadeDurationMs)
  }

  return (
    <div
      className="fixed inset-0 z-[120] bg-white cursor-pointer"
      style={{
        opacity: isFadingOut ? 0 : 1,
        transition: `opacity ${fadeDurationMs}ms ease`,
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleClick()
        }
      }}
      aria-label="Intro cover animation"
    >
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-xs tracking-[0.18em] uppercase text-black/70 select-none">
        {hintText}
      </div>
    </div>
  )
}
