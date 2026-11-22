'use client'

import { useEffect, useRef, useState } from 'react'
import PortfolioImage from './PortfolioImage'

// Ordered thresholds keep adjacent dots in register like a printed halftone.
const screen = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const contourPairs = ['|!', '/+', '-=', '\\+']

type LiveGlyph = { x: number; y: number; ink: string; pair: string; phase: number }

function engrave(photo: HTMLImageElement, plate: HTMLCanvasElement, light: HTMLCanvasElement) {
  const { width, height } = plate.getBoundingClientRect()
  if (!width || !height || !photo.naturalWidth) return
  const pitch = Math.max(7, width / 90, height / 62)
  const cols = Math.ceil(width / pitch), rows = Math.ceil(height / (pitch * 1.18))
  const dx = width / cols, dy = height / rows
  const scale = Math.max(width / photo.naturalWidth, height / photo.naturalHeight)
  const sampler = document.createElement('canvas')
  sampler.width = cols
  sampler.height = rows
  const sample = sampler.getContext('2d', { willReadFrequently: true })
  if (!sample) return
  const sw = photo.naturalWidth * scale / dx, sh = photo.naturalHeight * scale / dy
  sample.drawImage(photo, (cols - sw) / 2, (rows - sh) / 2, sw, sh)
  let pixels: Uint8ClampedArray | undefined
  try { pixels = sample.getImageData(0, 0, cols, rows).data } catch {
    // A cross-origin original remains visible under a lighter, unsampled screen.
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  for (const canvas of [plate, light]) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }
  const print = plate.getContext('2d'), glow = light.getContext('2d')
  if (!print || !glow) return
  for (const ctx of [print, glow]) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = `600 ${dy}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
  }

  const tones = new Float32Array(cols * rows)
  for (let i = 0; i < tones.length; i++) {
    tones[i] = pixels ? (pixels[i * 4] * .213 + pixels[i * 4 + 1] * .715 + pixels[i * 4 + 2] * .072) / 255 : .5
  }
  const tone = (x: number, y: number) => tones[Math.min(rows - 1, Math.max(0, y)) * cols + Math.min(cols - 1, Math.max(0, x))]
  const glyphs: LiveGlyph[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      if (pixels && !pixels[i * 4 + 3]) continue
      const value = tones[i]
      const gx = tone(x + 1, y) - tone(x - 1, y)
      const gy = tone(x, y + 1) - tone(x, y - 1)
      const edge = Math.hypot(gx, gy)
      const relief = value - (tone(x - 3, y) + tone(x + 3, y) + tone(x, y - 3) + tone(x, y + 3)) / 4
      const threshold = (screen[(y % 4) * 4 + x % 4] + .5) / 16
      const cx = (x + .5) * dx, cy = (y + .5) * dy
      const dark = value < .58
      const ink = dark ? '#fff5d8' : '#162b33'
      if (edge > .11 || Math.abs(relief) > .09) {
        // Orient each stroke along the local contour, across the brightness gradient.
        const direction = (Math.round(Math.atan2(gy, gx) / (Math.PI / 4)) + 8) % 4
        const pair = contourPairs[direction]
        print.fillStyle = dark ? 'rgba(9,24,37,.32)' : 'rgba(248,239,209,.32)'
        print.fillRect(x * dx, y * dy, dx, dy)
        if (edge > .21 && threshold < .36) {
          print.strokeStyle = dark ? 'rgba(193,233,234,.55)' : 'rgba(36,64,65,.45)'
          print.lineWidth = .65
          print.strokeRect(x * dx + .4, y * dy + .4, dx - .8, dy - .8)
        }
        glyphs.push({ x: cx, y: cy, ink, pair, phase: x / cols + .34 * Math.sin(y / rows * 6) })
      } else {
        const density = pixels ? .13 + .57 * (1 - value) + Math.min(.2, Math.abs(relief) * 2) : .17
        if (threshold > density) continue
        const pair = value < .32 ? 'x#' : value < .68 ? '+:' : '.:'
        if (threshold < density * .24) {
          glyphs.push({ x: cx, y: cy, ink, pair, phase: x / cols + .3 * Math.sin(y / rows * 6) })
        } else {
          print.fillStyle = dark ? 'rgba(251,241,218,.46)' : 'rgba(26,40,45,.38)'
          const dot = Math.max(1, dx * (.12 + .17 * (1 - value)))
          print.fillRect(cx - dot / 2, cy - dot / 2, dot, dot)
        }
      }
    }
  }

  return (time: number) => {
    glow.clearRect(0, 0, width, height)
    for (const cell of glyphs) {
      const wave = .5 + .5 * Math.cos((cell.phase - time / 7000) * 2 * Math.PI)
      const crest = wave ** 5
      glow.fillStyle = cell.ink
      glow.globalAlpha = .52 + .45 * crest
      glow.fillText(cell.pair[crest > .6 ? 1 : 0], cell.x, cell.y)
      if (crest > .72) {
        glow.globalAlpha = .12 * crest
        glow.fillText(cell.pair[1], cell.x - 1, cell.y)
        glow.fillText(cell.pair[1], cell.x + 1, cell.y)
      }
    }
    glow.globalAlpha = 1
  }
}

export default function AsciiCover({ src, title }: { src?: string; title: string }) {
  const plateRef = useRef<HTMLCanvasElement>(null)
  const lightRef = useRef<HTMLCanvasElement>(null)
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const plate = plateRef.current, light = lightRef.current
    if (!photo || !plate || !light) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let draw: ReturnType<typeof engrave>
    let visible = false
    let timer: number | undefined
    function sync() {
      window.clearInterval(timer)
      if (!draw || !visible || document.hidden) return
      draw(motion.matches ? 0 : performance.now())
      if (!motion.matches) timer = window.setInterval(() => draw?.(performance.now()), 125)
    }
    const resize = new ResizeObserver(() => { draw = engrave(photo, plate, light); sync() })
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    resize.observe(plate)
    visibility.observe(plate)
    motion.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      resize.disconnect()
      visibility.disconnect()
      window.clearInterval(timer)
      motion.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [photo])

  if (!src || missing) return <span className="missing-cover">Cover unavailable</span>
  return <>
    <PortfolioImage src={src} alt={title} fill sizes="(max-width: 760px) 100vw, 43vw"
      className="cover-photo" loading="eager" onLoad={e => setPhoto(e.currentTarget)} onError={() => setMissing(true)} />
    <canvas ref={plateRef} className="ascii-plate" aria-hidden="true" />
    <canvas ref={lightRef} className="ascii-light" aria-hidden="true" />
  </>
}
