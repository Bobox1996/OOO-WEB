'use client'

import { useRef, type CSSProperties } from 'react'
import Image from '@/components/sections/PortfolioImage'
import { folio, type CatalogProject } from '@/lib/portfolio'
import s from './drive-in.module.css'

export type Film = Pick<CatalogProject,'id'|'index'|'title'|'category'|'cover'>
export function Cover({project, sizes='300px'}:{project:Film;sizes?:string}) {
  return project.cover ? <Image src={project.cover.url} alt="" fill sizes={sizes} /> : <span className={s.blankArt} aria-hidden="true">OOO</span>
}
export function ProjectDeck({projects,index,select,screen,program,unavailable}:{
  projects:Film[];index:number;select:(n:number)=>void;screen:()=>void;program:()=>void;unavailable:boolean
}) {
  const current=projects[index],n=projects.length,touch=useRef<{x:number;y:number}|null>(null),swiped=useRef(false)
  const tabs=Array.from({length:Math.min(3,n-1)},(_,i)=>(index+i+1)%n)
  return <section className={s.console} aria-label="Vehicle touchscreen">
    <div className={s.consoleBar}><span><i /> Project deck</span>
      {n>0 && <button onClick={program} aria-label="Browse all projects">Index <b>☷</b></button>}</div>
    {current ? <>
      <div className={s.deck} onTouchStart={e=>{touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};swiped.current=false}}
        onTouchEnd={e=>{
          if(!touch.current)return
          const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y
          const delta=Math.abs(dx)>Math.abs(dy)?dx:dy
          if(Math.abs(delta)>32){swiped.current=true;select(index+(delta<0?1:-1))}
          touch.current=null
        }} onClickCapture={e=>{if(swiped.current){e.stopPropagation();swiped.current=false}}}>
        {tabs.map((j,depth)=><button key={projects[j].id} className={s.tab} style={{'--level':depth,'--paper':['#aac9b9','#c3b8c7','#e8b580'][depth]} as CSSProperties}
          onClick={()=>select(j)} aria-label={'Project '+(projects[j].index||folio(j))+': '+projects[j].title}>
          <span>{projects[j].index||folio(j)}</span> {projects[j].title}</button>).reverse()}
        <button className={s.frontCard} key={current.id} onClick={screen} aria-label={'Enlarge '+current.title}>
          <span className={s.thumb}><Cover project={current}/></span>
          <span className={s.cardText}><small>{current.index||folio(index)} / {current.category||'Project'}</small><strong>{current.title}</strong><span>View cover ↗</span></span>
        </button>
      </div>
      <div className={s.flip}><button aria-label="Previous project" disabled={n<2} onClick={()=>select(index-1)}>←</button>
        <span aria-live="polite">{folio(index)} <i>/</i> {String(n).padStart(2,'0')}</span>
        <button aria-label="Next project" disabled={n<2} onClick={()=>select(index+1)}>→</button></div>
    </> : <p className={s.empty}>{unavailable?'The project programme is temporarily unavailable.':'The next programme is being prepared.'}</p>}
  </section>
}
