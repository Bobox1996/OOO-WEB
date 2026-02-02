'use client'

import { ReactNode } from 'react'
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch'

interface ViewerContainerProps {
  children: ReactNode
}

// Zoom controls toolbar
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

export default function ViewerContainer({ children }: ViewerContainerProps) {
  return (
    <TransformWrapper
      initialScale={0.8}
      minScale={0.1}
      maxScale={10}
      centerOnInit
      wheel={{ step: 0.002 }}
      panning={{ velocityDisabled: true }}
    >
      <ZoomControls />
      <TransformComponent
        wrapperClass="!w-full !h-full"
        contentClass="!w-full !h-full flex items-center justify-center"
      >
        <div className="w-full h-full flex items-center justify-center">
          {children}
        </div>
      </TransformComponent>
    </TransformWrapper>
  )
}
