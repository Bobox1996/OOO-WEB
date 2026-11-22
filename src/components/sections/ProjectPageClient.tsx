'use client'

import { useState } from 'react'
import Image from '@/components/sections/PortfolioImage'
import Lightbox from '@/components/ui/Lightbox'
import type { Image as ProjectImage } from '@/types'
import { folio } from '@/lib/portfolio'

export default function ProjectPageClient({ images, title, description }: { images: ProjectImage[]; title: string; description: string | null }) {
  const [open, setOpen] = useState<number | null>(null)
  function figure(i: number) {
    const image = images[i]
    return <button className="folio-image" key={image.id} aria-label={'Enlarge image ' + (i + 1) + ' of ' + title} onClick={() => setOpen(i)}>
      <Image src={image.url} alt={image.filename || title} width={1500} height={1000}
        sizes={i === 0 ? '95vw' : '(max-width: 650px) 95vw, 75vw'} priority={i === 0} />
      <span>Fig. {folio(i)} <b>↗</b></span>
    </button>
  }
  const rows = []
  for (let i = 1; i < images.length; i++) {
    const paired = images[i].side_by_side && images[i + 1]?.side_by_side
    rows.push(<div className={'folio-row' + (paired ? ' paired' : '')} key={images[i].id}>
      {figure(i)}{paired && figure(i + 1)}
    </div>)
    if (paired) i++
  }
  return <>
    {images[0] && <div className="folio-hero">{figure(0)}</div>}
    {description && <section className="folio-copy"><h2>Project notes</h2><p>{description}</p></section>}
    {rows}
    {open !== null && <Lightbox images={images} currentIndex={open} onClose={() => setOpen(null)}
      onPrev={() => setOpen((open + images.length - 1) % images.length)} onNext={() => setOpen((open + 1) % images.length)} />}
  </>
}
