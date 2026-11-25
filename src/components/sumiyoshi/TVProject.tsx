import { useEffect, useRef, type Ref } from 'react'
import Image from '@/components/sections/PortfolioImage'
import { folio } from '@/lib/portfolio'
import type { ProjectDetails } from '@/lib/sumiyoshi-projects'
import type { Film } from '../drive-in/ProjectDeck'
import s from './sumiyoshi.module.css'

type ImageRef={id:string;url:string}

export function projectImages(film:Film,details?:ProjectDetails[string]):ImageRef[]{
  if(details?.images.length)return details.images
  return film.cover?[film.cover]:[]
}

type Props={
  film:Film;number:string;details?:ProjectDetails[string];imageIndex:number|null;
  selectImage:(i:number|null)=>void;step:(by:number)=>void;surface:Ref<HTMLElement>;flat:boolean
}
export function TVProject({film,number,details,imageIndex,selectImage,step,surface,flat}:Props){
  const images=projectImages(film,details),gallery=imageIndex!==null&&images.length>0
  const index=gallery?Math.min(imageIndex,images.length-1):0
  const hero=film.cover||images[0],photo=images[index]
  const swipe=useRef<{x:number;y:number}|null>(null)
  const overviewButton=useRef<HTMLButtonElement>(null)
  useEffect(()=>{overviewButton.current?.focus({preventScroll:true})},[])
  return <section ref={surface} aria-label="Project details on television"
    className={s.tvPaper+(flat?' '+s.flatPaper:'')} data-display={gallery?'gallery':'overview'}>
    <header className={s.tvMast}>
      <span className={s.projectNo}><i aria-hidden="true"/>Project {number}</span>
      <nav aria-label="Project views">
        <button ref={overviewButton} aria-pressed={!gallery} onClick={()=>selectImage(null)}>Overview</button>
        {images.length>0&&<button aria-pressed={gallery} onClick={()=>selectImage(0)}>Gallery</button>}
      </nav>
    </header>
    {gallery&&photo?<div className={s.tvGallery}>
      <div className={s.tvFigure} onTouchStart={e=>{swipe.current={x:e.touches[0].clientX,y:e.touches[0].clientY}}}
        onTouchEnd={e=>{const from=swipe.current;swipe.current=null;if(!from)return
          const dx=e.changedTouches[0].clientX-from.x,dy=e.changedTouches[0].clientY-from.y
          if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy)*1.4)step(dx<0?1:-1)
        }}>
        <Image key={photo.url} fill sizes="85vw" src={photo.url} alt={film.title+' — image '+(index+1)}/>
      </div>
      <footer className={s.photoControls}>
        <h2>{film.title}</h2>
        <button disabled={images.length<2} aria-label="Previous image" onClick={()=>step(-1)}>←</button>
        <span aria-live="polite">{folio(index)} / {String(images.length).padStart(2,'0')}</span>
        <button disabled={images.length<2} aria-label="Next image" onClick={()=>step(1)}>→</button>
      </footer>
    </div>:<div className={s.tvOverview}>
      <article className={s.tvReading} tabIndex={0} aria-label="Project notes">
        <h2>{film.title}</h2>
        <dl className={s.tvFacts}>
          {film.category&&<div><dt>Type</dt><dd>{film.category}</dd></div>}
          {details?.year&&details.year!=='-'&&<div><dt>{details.yearIsFiled?'Year filed':'Year'}</dt><dd>{details.year}</dd></div>}
          {details?.team&&<div><dt>Team</dt><dd>{details.team}</dd></div>}
        </dl>
        {details?.description&&<p>{details.description}</p>}
      </article>
      {hero&&<button className={s.tvHero} aria-label={'View gallery for '+film.title}
        onClick={()=>selectImage(Math.max(0,images.findIndex(i=>i.id===hero.id)))}>
        <Image key={hero.url} fill sizes="48vw" src={hero.url} alt={film.title}/>
      </button>}
    </div>}
  </section>
}
