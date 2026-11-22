'use client'

import Image from '@/components/sections/PortfolioImage'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { folio, type CatalogProject } from '@/lib/portfolio'

const catPixels = [
  '                     #   #  ',
  ' #                   ## ##  ',
  ' ##                  #####  ',
  '  ##                ####.## ',
  '   ##              #########',
  '    ############# ######### ',
  '     ####################   ',
  '     ##################     ',
  '     ################       ',
  '      ##############        ',
  '      ####     ####         ',
  '     ### ##    ## ##        ',
  '    ###   ##   ##  ##       ',
  '    ###   ###  ###  ###     ',
]

function PixelCat() {
  return <svg viewBox="0 0 28 14" aria-hidden="true" shapeRendering="crispEdges">
    {catPixels.flatMap((row, y) => Array.from(row.matchAll(/#+/g), m =>
      <rect key={y + '-' + m.index} x={m.index} y={y} width={m[0].length} height="1" />))}
  </svg>
}

type Controls = { step: (direction: number) => void; jump: () => void }

export default function ProjectArcade({ projects, onStand, onHit, active }: {
  projects: CatalogProject[]; onStand: (index: number) => void; onHit: (index: number) => void; active: number
}) {
  const area = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const cat = useRef<HTMLDivElement>(null)
  const controls = useRef<Controls | null>(null)

  useEffect(() => {
    const section = area.current!, view = viewport.current!, sprite = cat.current!
    const blocks = Array.from(view.querySelectorAll<HTMLAnchorElement>('.cover-block'))
    if (!blocks.length) return
    let x = 0, height = 0, velocity = 0, direction = 1, target: number | null = null
    let frame = 0, prevTime = 0, visible = true, lastScroll = view.scrollLeft
    let centers: number[] = [], halfWidth = 0, lastStand = -1
    let leftKey = false, rightKey = false
    const nearest = () => centers.reduce((best, p, i) => Math.abs(p - x) < Math.abs(centers[best] - x) ? i : best, 0)
    const clamp = (p: number) => Math.max(centers[0], Math.min(centers[centers.length - 1], p))
    function paint() {
      sprite.style.transform = 'translate(' + (x - sprite.offsetWidth / 2) + 'px,' + -height + 'px) scaleX(' + direction + ')'
      const i = nearest()
      const under = Math.abs(centers[i] - x) <= halfWidth ? i : -1
      if (under !== lastStand) { lastStand = under; onStand(under) }
    }
    function measure() {
      const i = centers.length ? nearest() : 0
      centers = blocks.map(b => b.offsetLeft + b.offsetWidth / 2)
      halfWidth = blocks[0].offsetWidth / 2
      x = centers[i]
      target = null
      paint()
    }
    function tick(now: number) {
      frame = 0
      const dt = Math.min((now - (prevTime || now)) / 1000, .033)
      prevTime = now
      const input = Number(rightKey) - Number(leftKey)
      const oldX = x
      if (input) { direction = input; target = null; x = clamp(x + input * 370 * dt) }
      else if (target !== null) {
        const delta = target - x
        direction = Math.sign(delta) || direction
        x += direction * Math.min(Math.abs(delta), 570 * dt)
        if (x === target) target = null
      }
      if (oldX !== x) {
        const margin = Math.min(view.clientWidth * .3, 220)
        const screenX = x - view.scrollLeft
        if (screenX < margin) view.scrollLeft = x - margin
        else if (screenX > view.clientWidth - margin) view.scrollLeft = x - view.clientWidth + margin
        lastScroll = view.scrollLeft
      }
      if (height > 0 || velocity > 0) {
        const previous = height
        height = Math.max(0, height + velocity * dt)
        velocity -= 1450 * dt
        const i = nearest(), block = blocks[i]
        const underside = sprite.offsetTop - (block.offsetTop + block.offsetHeight)
        if (velocity > 0 && previous <= underside && height >= underside && Math.abs(x - centers[i]) <= halfWidth + 3) {
          height = underside
          velocity = -65
          onHit(i)
          if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
            block.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-7px)' }, { transform: 'translateY(0)' }], 200)
        }
        if (height === 0) velocity = 0
      }
      sprite.classList.toggle('walking', oldX !== x && height === 0)
      paint()
      if (input || target !== null || velocity !== 0 || height > 0) frame = requestAnimationFrame(tick)
      else prevTime = 0
    }
    function wake() { if (!frame) { prevTime = performance.now(); frame = requestAnimationFrame(tick) } }
    function jump() { if (height === 0 && velocity === 0) { velocity = 540; wake() } }
    controls.current = {
      step(d) {
        const current = target !== null ? centers.indexOf(target) : nearest()
        target = centers[Math.max(0, Math.min(centers.length - 1, current + d))]
        wake()
      }, jump,
    }
    function keydown(e: KeyboardEvent) {
      if (!visible || e.metaKey || e.ctrlKey || e.altKey || (e.target instanceof HTMLElement &&
        (e.target.isContentEditable || e.target.closest('input, textarea, select, [role="dialog"]')))) return
      if (e.code === 'Space' && (e.target as Element)?.closest?.('a,button')) return
      switch (e.code) {
        case 'ArrowLeft': case 'KeyA': leftKey = true; break
        case 'ArrowRight': case 'KeyD': rightKey = true; break
        case 'Space': case 'ArrowUp': case 'KeyW': if (!e.repeat) jump(); break
        default: return
      }
      e.preventDefault()
      wake()
    }
    function keyup(e: KeyboardEvent) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') leftKey = false
      if (e.code === 'ArrowRight' || e.code === 'KeyD') rightKey = false
    }
    function release() { leftKey = rightKey = false }
    function scrolled() {
      const delta = view.scrollLeft - lastScroll
      lastScroll = view.scrollLeft
      if (delta) { x = clamp(x + delta); target = null; paint() }
    }
    function wheel(e: WheelEvent) {
      if (e.ctrlKey || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || !e.target || !(e.target as Element).closest('.cover-strip')) return
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1)
      if ((delta > 0 && view.scrollLeft + view.clientWidth < view.scrollWidth - 1) || (delta < 0 && view.scrollLeft > 0)) {
        e.preventDefault(); view.scrollLeft += delta
      }
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(view)
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) release() }, { threshold: .25 })
    observer.observe(section)
    view.addEventListener('scroll', scrolled, { passive: true })
    view.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    window.addEventListener('blur', release)
    return () => {
      controls.current = null
      cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect()
      view.removeEventListener('scroll', scrolled); view.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', release)
    }
  }, [projects, onStand, onHit])

  return <section className="arcade" ref={area} aria-label="Project arcade">
    <div className="arcade-heading"><h2><i className="solid-dot" />Project arcade</h2><span>← → Move <b>/</b> Space to jump</span></div>
    <div className="arcade-viewport" ref={viewport} tabIndex={0} aria-label="Scrollable project covers and cat game">
      <div className="arcade-world">
        <div className="cover-strip">{projects.map((p, i) =>
          <Link href={'/project/' + p.id} prefetch={false} className={'cover-block' + (active === i ? ' under-cat' : '')} key={p.id} aria-label={'Open ' + p.title}>
            {p.cover ? <Image draggable={false} fill sizes="180px" src={p.cover.url} alt={p.title} /> : <span className="no-thumb">{p.title}</span>}
            <span className="cover-no">{folio(i)}</span>
          </Link>)}</div>
        <div ref={cat} className="pixel-cat" aria-hidden="true"><PixelCat /></div>
      </div>
    </div>
    <div className="arcade-controls">
      <div className="walk-controls"><button type="button" aria-label="Move left" onClick={() => controls.current?.step(-1)}>←</button>
        <button type="button" aria-label="Move right" onClick={() => controls.current?.step(1)}>→</button></div>
      <span className="arcade-hint">Jump to preview a project</span>
      <button className="jump-key" type="button" onClick={() => controls.current?.jump()}>Jump <span>↑</span></button>
    </div>
  </section>
}
