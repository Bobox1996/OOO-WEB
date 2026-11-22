import Link from 'next/link'
import Image from '@/components/sections/PortfolioImage'
import type { CatalogProject } from '@/lib/portfolio'

function randomSource(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

export default function ImageArchive({ projects, seed }: { projects: CatalogProject[]; seed: number }) {
  const random = randomSource(seed)
  const entries = projects.flatMap(project => project.images.map(image => ({
    project, image, cover: image.id === project.cover?.id, sort: random(),
    width: random(), inset: random(), drop: random(),
  }))).sort((a, b) => a.sort - b.sort)
  const rows: (typeof entries)[] = []
  for (let i = 0; i < entries.length;) {
    const count = random() > .76 && !entries.slice(i, i + 3).some(e => e.cover) ? 3 : 2
    rows.push(entries.slice(i, i + count))
    i += count
  }
  return <section className="image-archive" id="image-archive" aria-label="Image archive">
    <header className="archive-head"><h2>Image archive<sup>({entries.length})</sup></h2><a href="#index">Back to index ↑</a></header>
    <div className="archive-rows">{rows.map(row => <div className="archive-row" key={row[0].image.id}>
      {row.map(({ image, project, cover, width, inset, drop }) => {
        const size = cover ? 92 + width * 8 : 57 + width * 24
        return <div className="archive-cell" key={image.id}>
          <Link href={'/project/' + project.id} prefetch={false} aria-label={'Open ' + project.title}
            className={'archive-print' + (cover ? ' cover-print' : '')}
            style={{ width: size + '%', marginInlineStart: ((100 - size) * inset) + '%', marginTop: (drop * 8) + 'vw' }}>
            <Image src={image.url} alt={project.title} width={1000} height={750}
              sizes="(max-width: 650px) 90vw, 48vw" loading="lazy" />
          </Link>
        </div>
      })}
    </div>)}</div>
    <div className="team-dock"><Link href="/team"><span className="dock-dot" />TEAM <b aria-hidden="true">↗</b></Link></div>
  </section>
}
