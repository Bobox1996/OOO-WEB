'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { folio, type CatalogProject } from '@/lib/portfolio'
import AsciiCover from './AsciiCover'
import ProjectArcade from './ProjectArcade'

export default function HomePageClient({ projects, unavailable, children }: {
  projects: CatalogProject[]; unavailable: boolean; children: React.ReactNode
}) {
  const [active, setActive] = useState(0)
  const [selected, setSelected] = useState(0)
  const directory = useRef<HTMLDivElement>(null)
  const preview = projects[selected]
  useEffect(() => {
    const list = directory.current
    const row = list?.children[active] as HTMLElement | undefined
    if (!row || !list) return
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop
    if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight
  }, [active])

  return <main id="index">
    <div className="index-page">
      <section className="index-section" aria-labelledby="index-title">
        <div className="index-heading"><h1 id="index-title">Project index<sup>({String(projects.length).padStart(2, '0')})</sup></h1>
          <a className="archive-shortcut" href="#image-archive">Image archive <span>↓</span></a>
        </div>
        {preview ? <div className="index-board">
          <div className="catalog-labels catalog-grid" aria-hidden="true">
            <div className="catalog-left"><span>Index</span><span>Project</span></div>
            <div className="catalog-right"><span>Year</span><span>Type</span></div>
          </div>
          <div className="catalog-scroll" ref={directory} role="list" aria-label="Project directory">
            {projects.map((p, i) => <div key={p.id} role="listitem" className={'catalog-row catalog-grid' + (active === i ? ' is-active' : '')}>
              <Link className="catalog-left" href={'/project/' + p.id} prefetch={false}>
                <span>{p.index || folio(i)}</span><strong>{p.title}</strong>
              </Link>
              <Link className="catalog-right" href={'/project/' + p.id} prefetch={false} tabIndex={-1} aria-label={'Open ' + p.title}>
                <span title={p.yearIsFiled ? 'Year added to the archive' : 'Project year'}>{p.year}{p.yearIsFiled && <sup>*</sup>}</span>
                <span>{p.category || '—'}</span>
              </Link>
            </div>)}
          </div>
          {projects.some(p => p.yearIsFiled) && <small className="year-note">* Year added to the archive</small>}
          <div className="preview-plate">
            <div className="preview-meta"><span><i className="solid-dot" /> Cover preview</span><span>FIG. {folio(selected)}</span></div>
            <Link className="preview-link" href={'/project/' + preview.id} aria-label={'Check ' + preview.title}>
              <i className="corner tl"/><i className="corner tr"/><i className="corner bl"/><i className="corner br"/>
              <AsciiCover key={preview.id} src={preview.cover?.url} title={preview.title} />
              <span className="check-key">CHECK <b>↗</b></span>
            </Link>
            <div className="preview-caption" aria-live="polite"><span>{preview.title}</span><span>ASCII overlay</span></div>
          </div>
        </div> : <p className="catalog-empty">{unavailable ? 'The project index could not be loaded. Please refresh to try again.' : 'No projects have been published yet.'}</p>}
      </section>
      {preview && <ProjectArcade projects={projects} active={active} onStand={setActive} onHit={setSelected} />}
    </div>
    {children}
  </main>
}
