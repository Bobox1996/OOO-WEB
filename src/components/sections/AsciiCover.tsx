'use client'

import { useEffect, useRef, useState } from 'react'
import NextImage, { getImageProps } from 'next/image'

const ramp = ' .:-=+*x#%@'

export default function AsciiCover({ src, title }: { src?: string; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !src) return
    let active = true
    const photo = new Image()
    // Share the thumbnail request with the game instead of downloading a second rendition.
    const optimized = getImageProps({ src, alt: '', fill: true, sizes: '180px' }).props
    photo.crossOrigin = 'anonymous'

    function draw() {
      if (!canvas || !active || !photo.naturalWidth) return
      const { width, height } = canvas.getBoundingClientRect()
      if (!width || !height) return
      const scale = Math.min(width / photo.naturalWidth, height / photo.naturalHeight)
      const w = photo.naturalWidth * scale, h = photo.naturalHeight * scale
      const step = Math.max(3, w / 150)
      const cols = Math.max(1, Math.floor(w / step)), rows = Math.max(1, Math.floor(h / (step * 1.65)))
      const sampler = document.createElement('canvas')
      sampler.width = cols
      sampler.height = rows
      const sample = sampler.getContext('2d', { willReadFrequently: true })
      const ctx = canvas.getContext('2d')
      if (!sample || !ctx) return
      sample.fillStyle = '#fff'
      sample.fillRect(0, 0, cols, rows)
      sample.drawImage(photo, 0, 0, cols, rows)
      let pixels: Uint8ClampedArray
      try { pixels = sample.getImageData(0, 0, cols, rows).data } catch { setFailed(true); return }
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.scale(dpr, dpr)
      ctx.font = 'bold ' + (step * 1.9) + 'px monospace'
      ctx.textBaseline = 'middle'
      const left = (width - w) / 2, top = (height - h) / 2
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = 4 * (y * cols + x)
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
          const luminance = (r * .2126 + g * .7152 + b * .0722) / 255
          const symbol = ramp[Math.min(ramp.length - 1, Math.floor((1 - luminance) ** .68 * ramp.length))]
          if (symbol === ' ') continue
          ctx.fillStyle = 'rgb(' + Math.round(r * .85) + ',' + Math.round(g * .85) + ',' + Math.round(b * .85) + ')'
          ctx.fillText(symbol, left + x * w / cols, top + (y + .5) * h / rows)
        }
      }
    }
    photo.onload = draw
    let triedOriginal = false
    photo.onerror = () => {
      if (!active) return
      if (triedOriginal || optimized.src === src) { setFailed(true); return }
      triedOriginal = true
      photo.removeAttribute('srcset')
      photo.src = src
    }
    photo.sizes = optimized.sizes || '180px'
    photo.srcset = optimized.srcSet || ''
    photo.src = optimized.src
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => { active = false; observer.disconnect(); photo.onload = photo.onerror = null }
  }, [src])

  if (!src) return <span className="missing-cover">Cover unavailable</span>
  if (failed) return <NextImage className="preview-fallback" unoptimized width={480} height={320} src={src} alt={title} />
  return <canvas className="ascii-canvas" ref={canvasRef} role="img" aria-label={'Color ASCII rendering of ' + title} />
}
