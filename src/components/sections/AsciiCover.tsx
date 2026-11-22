'use client'

import { useEffect, useRef, useState } from 'react'
import PortfolioImage from './PortfolioImage'

const density = ' .:-=+x#'

function paintGlass(photo: HTMLImageElement, grain: HTMLCanvasElement, glass: HTMLCanvasElement) {
  const { width, height } = grain.getBoundingClientRect()
  if (!width || !height || !photo.naturalWidth) return

  // Sample the same centered cover crop as the photograph underneath.
  const scale = Math.max(width / photo.naturalWidth, height / photo.naturalHeight)
  const pitch = Math.max(6, width / 140, height / 100)
  const cols = Math.ceil(width / pitch)
  const rows = Math.ceil(height / (pitch * 1.2))
  const sampler = document.createElement('canvas')
  sampler.width = cols
  sampler.height = rows
  const sample = sampler.getContext('2d', { willReadFrequently: true })
  if (!sample) return
  const scaledWidth = photo.naturalWidth * scale * cols / width
  const scaledHeight = photo.naturalHeight * scale * rows / height
  sample.drawImage(photo, (cols - scaledWidth) / 2, (rows - scaledHeight) / 2, scaledWidth, scaledHeight)
  let pixels: Uint8ClampedArray | undefined
  try {
    pixels = sample.getImageData(0, 0, cols, rows).data
  } catch {
    // Original URLs without CORS still get a translucent screen over the photograph.
  }

  const cellWidth = width / cols
  const cellHeight = height / rows
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  for (const canvas of [grain, glass]) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }
  const base = grain.getContext('2d')
  const moving = glass.getContext('2d')
  if (!base || !moving) return
  for (const ctx of [base, moving]) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = `${cellHeight}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = 4 * (row * cols + col)
      if (pixels && !pixels[i + 3]) continue
      const neutral = 110 + (col * 7 + row * 17) % 65
      const r = pixels?.[i] ?? neutral, g = pixels?.[i + 1] ?? neutral, b = pixels?.[i + 2] ?? neutral
      const light = (r * .2126 + g * .7152 + b * .0722) / 255
      const level = Math.round((1 - light) * (density.length - 1))
      const x = col * cellWidth, y = row * cellHeight
      const centerX = x + cellWidth / 2, centerY = y + cellHeight / 2
      if (pixels) {
        base.fillStyle = `rgba(${r},${g},${b},.34)`
        base.fillRect(x, y, cellWidth, cellHeight)
      }
      base.fillStyle = light < .48 ? 'rgba(248,249,241,.33)' : 'rgba(24,29,25,.27)'
      base.fillText(density[level], centerX, centerY)
      // Alternating tonal regions form a second glyph field under the drifting glass mask.
      moving.fillStyle = light < .68 ? 'rgba(250,250,239,.62)' : 'rgba(39,50,44,.40)'
      moving.fillText(light < .35 ? '+' : light < .68 ? '^' : ':', centerX, centerY)
    }
  }
}

export default function AsciiCover({ src, title }: { src?: string; title: string }) {
  const grainRef = useRef<HTMLCanvasElement>(null)
  const glassRef = useRef<HTMLCanvasElement>(null)
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const grain = grainRef.current, glass = glassRef.current
    if (!photo || !grain || !glass) return
    const resize = new ResizeObserver(() => paintGlass(photo, grain, glass))
    resize.observe(grain)
    const visibility = new IntersectionObserver(([entry]) => {
      glass.dataset.visible = String(entry.isIntersecting)
    })
    visibility.observe(glass)
    return () => { resize.disconnect(); visibility.disconnect() }
  }, [photo])

  if (!src || missing) return <span className="missing-cover">Cover unavailable</span>
  return <>
    <PortfolioImage src={src} alt={title} fill sizes="(max-width: 760px) 100vw, 43vw"
      className="cover-photo" loading="eager" onLoad={e => setPhoto(e.currentTarget)} onError={() => setMissing(true)} />
    <canvas ref={grainRef} className="ascii-grain" aria-hidden="true" />
    <canvas ref={glassRef} className="ascii-glass" aria-hidden="true" />
  </>
}
