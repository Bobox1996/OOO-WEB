'use client'

import { ReactNode, useRef, useCallback } from 'react'
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch'

interface LogoOverlayBase {
  x: number
  y: number
  scale: number
  rotation: number
}

interface ViewerContainerProps {
  children: ReactNode
  logoOverlay?: LogoOverlayBase | null
  onLogoMove?: (x: number, y: number) => void
  onLogoScale?: (scale: number) => void
  onLogoRotate?: (rotation: number) => void
  onLogoSelect?: () => void
  onLogoDeselect?: () => void
}

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls()

  return (
    <div className="absolute top-4 right-4 flex gap-1 z-10">
      <button
        onClick={() => zoomIn()}
        className="w-10 h-10 bg-white border border-black/20 text-black text-lg font-medium hover:bg-neutral-100 transition-colors flex items-center justify-center"
        title="Zoom In"
      >
        +
      </button>
      <button
        onClick={() => zoomOut()}
        className="w-10 h-10 bg-white border border-black/20 text-black text-lg font-medium hover:bg-neutral-100 transition-colors flex items-center justify-center"
        title="Zoom Out"
      >
        −
      </button>
      <button
        onClick={() => resetTransform()}
        className="h-10 px-3 bg-white border border-black/20 text-black text-xs uppercase tracking-wider font-medium hover:bg-neutral-100 transition-colors flex items-center justify-center"
        title="Reset View"
      >
        Reset
      </button>
    </div>
  )
}

type DragMode = 'none' | 'move' | 'scale' | 'rotate'

function DraggableContent({
  children,
  logoOverlay,
  onLogoMove,
  onLogoScale,
  onLogoRotate,
  onLogoSelect,
  onLogoDeselect,
}: {
  children: ReactNode
  logoOverlay?: LogoOverlayBase | null
  onLogoMove?: (x: number, y: number) => void
  onLogoScale?: (scale: number) => void
  onLogoRotate?: (rotation: number) => void
  onLogoSelect?: () => void
  onLogoDeselect?: () => void
}) {
  const mode = useRef<DragMode>('none')
  const dragStart = useRef({ x: 0, y: 0 })
  const logoStart = useRef({ x: 0, y: 0 })
  const initialScale = useRef(1)
  const initialRotation = useRef(0)
  const initialDistance = useRef(1)
  const initialAngle = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const screenToSvg = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return null
    const svg = containerRef.current.querySelector('svg')
    if (!svg) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    return pt.matrixTransform(ctm.inverse())
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as Element

    if (target.closest('.logo-rotate-handle')) {
      if (!logoOverlay || !onLogoRotate) return
      e.stopPropagation()
      e.preventDefault()
      mode.current = 'rotate'
      initialRotation.current = logoOverlay.rotation

      const svgPt = screenToSvg(e.clientX, e.clientY)
      if (svgPt) {
        initialAngle.current = Math.atan2(svgPt.y - logoOverlay.y, svgPt.x - logoOverlay.x)
      }

      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      onLogoSelect?.()
      return
    }

    if (target.closest('.logo-scale-handle')) {
      if (!logoOverlay || !onLogoScale) return
      e.stopPropagation()
      e.preventDefault()
      mode.current = 'scale'
      initialScale.current = logoOverlay.scale

      const svgPt = screenToSvg(e.clientX, e.clientY)
      if (svgPt) {
        const dx = svgPt.x - logoOverlay.x
        const dy = svgPt.y - logoOverlay.y
        initialDistance.current = Math.sqrt(dx * dx + dy * dy) || 1
      }

      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      onLogoSelect?.()
      return
    }

    if (target.closest('.logo-draggable')) {
      if (!logoOverlay || !onLogoMove) return
      e.stopPropagation()
      e.preventDefault()
      mode.current = 'move'
      logoStart.current = { x: logoOverlay.x, y: logoOverlay.y }

      const svgPt = screenToSvg(e.clientX, e.clientY)
      if (svgPt) {
        dragStart.current = { x: svgPt.x, y: svgPt.y }
      }

      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      onLogoSelect?.()
      return
    }

    onLogoDeselect?.()
  }, [logoOverlay, onLogoMove, onLogoScale, onLogoRotate, onLogoSelect, onLogoDeselect, screenToSvg])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (mode.current === 'none') return
    e.stopPropagation()
    e.preventDefault()

    const svgPt = screenToSvg(e.clientX, e.clientY)
    if (!svgPt || !logoOverlay) return

    if (mode.current === 'move' && onLogoMove) {
      const dx = svgPt.x - dragStart.current.x
      const dy = svgPt.y - dragStart.current.y
      onLogoMove(logoStart.current.x + dx, logoStart.current.y + dy)
    }

    if (mode.current === 'scale' && onLogoScale) {
      const dx = svgPt.x - logoOverlay.x
      const dy = svgPt.y - logoOverlay.y
      const newDistance = Math.sqrt(dx * dx + dy * dy) || 1
      const ratio = newDistance / initialDistance.current
      onLogoScale(Math.max(0.005, initialScale.current * ratio))
    }

    if (mode.current === 'rotate' && onLogoRotate) {
      const newAngle = Math.atan2(svgPt.y - logoOverlay.y, svgPt.x - logoOverlay.x)
      const delta = (newAngle - initialAngle.current) * (180 / Math.PI)
      let newRotation = initialRotation.current + delta
      while (newRotation < 0) newRotation += 360
      while (newRotation >= 360) newRotation -= 360
      onLogoRotate(newRotation)
    }
  }, [logoOverlay, onLogoMove, onLogoScale, onLogoRotate, screenToSvg])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (mode.current === 'none') return
    mode.current = 'none'
    e.stopPropagation()
    ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {children}
    </div>
  )
}

export default function ViewerContainer({
  children,
  logoOverlay,
  onLogoMove,
  onLogoScale,
  onLogoRotate,
  onLogoSelect,
  onLogoDeselect,
}: ViewerContainerProps) {
  return (
    <TransformWrapper
      initialScale={0.8}
      minScale={0.1}
      maxScale={10}
      centerOnInit
      wheel={{ step: 0.002 }}
      panning={{ velocityDisabled: true, excluded: ['logo-draggable', 'logo-scale-handle', 'logo-rotate-handle'] }}
    >
      <ZoomControls />
      <TransformComponent
        wrapperClass="!w-full !h-full"
        contentClass="!w-full !h-full flex items-center justify-center"
      >
        <DraggableContent
          logoOverlay={logoOverlay}
          onLogoMove={onLogoMove}
          onLogoScale={onLogoScale}
          onLogoRotate={onLogoRotate}
          onLogoSelect={onLogoSelect}
          onLogoDeselect={onLogoDeselect}
        >
          {children}
        </DraggableContent>
      </TransformComponent>
    </TransformWrapper>
  )
}
