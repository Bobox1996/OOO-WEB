'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from '@/components/sections/PortfolioImage'
import StudioLogo from '@/components/layout/StudioLogo'
import { folio } from '@/lib/portfolio'
import type { ProjectDetails } from '@/lib/sumiyoshi-projects'
import roster from '../../../art/sumiyoshi/cast/roster.json'
import type { Film } from '../drive-in/ProjectDeck'
import type { TeamMember } from '@/types'
import { opening, type View } from './camera'
import { areas, stops, memberStops, type Point, type Stop } from './world'
import type { Game } from './scene'
import { projectImages, TVProject } from './TVProject'
import s from './sumiyoshi.module.css'

type Member=Pick<TeamMember,'id'|'first_name'|'last_name'|'description'|'portrait_url'>
type Props={projects:Film[];members:Member[];vision:string|null;intro:string|null;unavailable:boolean;projectDetails:ProjectDetails}
type Panel='guide'|'routes'|'label'|null
const placeNames={home:'Garden room',street:'Sumiyoshi street',cafe:'Forest café'}
const stopNames:Record<Exclude<Stop,(typeof memberStops)[number]>,string>={
  sofa:'Sit on sofa','home-door':'Front door','home-entry':'Garden house','cafe-entry':'Forest café','cafe-door':'Back to street',vision:'VISION vending machine',
}
const roles=['At the coffee bar','Behind the counter','Ordering coffee','At the window table','Beside the long bench','At the corner table','By the café entrance']
const residentIds=roster.people.filter(p=>p.memberId).map(p=>p.memberId)
function memberName(member:Member|undefined,i:number){return member?[member.first_name,member.last_name].filter(Boolean).join(' '):'Team member '+folio(i)}

function Conversation({person,index,done}:{person:Member|undefined;index:number;done:()=>void}){
  const [page,setPage]=useState(0)
  const text=person?.description?.trim()==='CEO'?'I’m the CEO. Welcome to our café.':person?.description||'Welcome to the Forest café.'
  const pages=text.trim().split(/\r?\n\s*\r?\n/).filter(Boolean)
  return <section className={s.bubble+' '+s.conversation} aria-label="Member conversation">
    <div className={s.dialogueTop}><small>Forest café · {roles[index]}</small><button onClick={done}>Done <kbd>Space</kbd></button></div>
    <div className={s.bio}>{person?.portrait_url&&<div className={s.portrait}><Image fill sizes="64px" src={person.portrait_url} alt=""/></div>}
      <div><h2>{memberName(person,index)}</h2><p aria-live="polite">{pages[page]}</p></div></div>
    {pages.length>1&&<div className={s.speechPages}><button aria-label="Previous part" disabled={!page} onClick={()=>setPage(page-1)}>←</button>
      <span>{folio(page)} / {String(pages.length).padStart(2,'0')}</span><button onClick={()=>page===pages.length-1?done():setPage(page+1)}>{page===pages.length-1?'Finish':'Continue'} →</button></div>}
  </section>
}

function Sheet({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{
    const el=ref.current,prior=document.activeElement
    el?.showModal()
    return ()=>{el?.close();if(prior instanceof HTMLElement&&prior.isConnected)prior.focus({preventScroll:true})}
  },[])
  return <dialog className={s.sheet} ref={ref} aria-label={title} onCancel={e=>{e.preventDefault();close()}}
    onClick={e=>{if(e.target===ref.current)close()}}>
    <div className={s.sheetInner}><div className={s.sheetHead}><h2>{title}</h2><button autoFocus aria-label="Close" onClick={close}>×</button></div>{children}</div>
  </dialog>
}

export default function Sumiyoshi({projects,members:directory,vision,unavailable,projectDetails}:Props){
  const members=residentIds.map(id=>directory.find(m=>m.id===id))
  const [view,setView]=useState<View>(opening),[selected,setSelected]=useState(0),[panel,setPanel]=useState<Panel>(null)
  const [renderer,setRenderer]=useState<'loading'|'ready'|'off'>('loading'),[retry,setRetry]=useState(0)
  const [near,setNear]=useState<Stop|null>(null),[destination,setDestination]=useState<Stop|null>(null)
  const [hasCola,setHasCola]=useState(false)
  const [detail,setDetail]=useState<{project:string;image:number|null}|null>(null)
  const host=useRef<HTMLDivElement>(null),game=useRef<Game|null>(null),spawn=useRef<Point|undefined>(undefined)
  const tvPage=useRef<HTMLElement|null>(null)
  const detailsButton=useRef<HTMLButtonElement>(null)
  const tabNavigation=useRef(false)
  const surface=useCallback((el:HTMLElement|null)=>{tvPage.current=el;game.current?.attachTVDocument(el)},[])
  const filmstrip=useRef<HTMLDivElement>(null),num=projects.length
  const {area,mode,member}=view,film=projects[selected],person=members[member]
  const watching=mode==='seated'||mode==='focus'
  const showingDetails=!!film&&mode==='focus'&&detail?.project===film.id
  const info=film?projectDetails?.[film.id]:undefined
  const imageCount=film?projectImages(film,info).length:0
  const flip=useCallback((by:number)=>{setDetail(null);setSelected(i=>num?(i+num+by)%num:0)},[num])
  const stepImage=useCallback((by:number)=>{
    if(!imageCount)return
    setDetail(d=>d?{...d,image:d.image===null?(by>0?0:imageCount-1):(d.image+by+imageCount)%imageCount}:null)
  },[imageCount])
  const remote=showingDetails?stepImage:flip
  const stand=()=>{setDetail(null);setView(v=>({...v,mode:'walk'}))}
  const showBottle=useCallback(()=>{setHasCola(true);setView(v=>({...v,mode:'bottle'}))},[])
  const arrive=useCallback((id:Stop)=>{
    setPanel(null);setDestination(null)
    const act=stops[id].action
    if(act.kind==='door'){
      const arrival=stops[act.arrival];spawn.current=arrival.spawn
      setView(v=>({...v,area:arrival.area,mode:'walk'}))
    }else if(act.kind==='member')setView(v=>({...v,member:act.index,mode:'talk'}))
    else setView(v=>({...v,mode:act.kind==='sofa'?'seated':'vendor'}))
  },[])
  const focus=useCallback(()=>setView(v=>({...v,mode:'focus'})),[])
  useEffect(()=>{
    let cancelled=false
    function fallback(reason:string){
      if(cancelled)return
      console.warn('Sumiyoshi preview:',reason);game.current?.dispose();game.current=null;setRenderer('off')
    }
    import('./scene').then(({createStreetGame})=>{
      if(cancelled||!host.current)return
      game.current=createStreetGame(host.current,{
        ready:()=>{if(!cancelled)setRenderer('ready')},failure:fallback,arrive,focus,flip,
        near:setNear,moving:()=>setDestination(null),label:()=>setPanel('label'),
      },vision||'')
    }).catch(e=>fallback(String(e)))
    return ()=>{cancelled=true;game.current?.dispose();game.current=null}
  },[arrive,flip,focus,retry,vision])
  useEffect(()=>{game.current?.setView(view,spawn.current);spawn.current=undefined},[view,renderer])
  useEffect(()=>{game.current?.setFilm(film?.cover?.url||null,film?.title||'Out Of Office')},[film,renderer])
  useEffect(()=>{game.current?.pause(!!panel)},[panel,renderer])
  useEffect(()=>{game.current?.attachTVDocument(tvPage.current)},[renderer])
  useEffect(()=>{
    const strip=filmstrip.current,card=strip?.children[selected] as HTMLElement|undefined
    if(strip&&card){
      const offset=card.offsetLeft-strip.offsetLeft,w=card.offsetWidth,padding=8
      if(offset<strip.scrollLeft+padding||offset+w>strip.scrollLeft+strip.clientWidth-padding){
        strip.scrollTo({left:offset-strip.clientWidth/2+w/2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})
      }
    }
  },[selected,watching])
  function destinationName(id:Stop){const a=stops[id].action;return a.kind==='member'?memberName(members[a.index],a.index):stopNames[id as keyof typeof stopNames]}
  function travel(id:Stop){
    setPanel(null)
    if(renderer==='ready'&&game.current){if(game.current.go(id))setDestination(id)}
    else arrive(id)
  }
  useEffect(()=>{
    function key(e:KeyboardEvent){
      if(panel||e.altKey||e.ctrlKey||e.metaKey||e.repeat)return
      const k=e.key.toLowerCase()
      if(k==='tab'){tabNavigation.current=true;return}
      if(watching&&['arrowright','arrowleft'].includes(k)){e.preventDefault();remote(k==='arrowright'?1:-1)}
      else if(mode==='seated'&&k==='enter'&&e.target===document.body){e.preventDefault();focus()}
      else if(e.code==='Space'||k===' '){
        const target=e.target instanceof HTMLElement?e.target:null
        if(target?.closest('input,textarea,select,[contenteditable=true]'))return
        if(target?.closest('[aria-label="Project details on television"]')||
          (tabNavigation.current&&target?.closest('button,a')))return
        e.preventDefault()
        if(watching)stand()
        else if(mode==='walk'&&near)arrive(near)
        else if(mode==='vendor')showBottle()
        else if(mode!=='walk')stand()
      }else if(k==='escape'){
        if(showingDetails){setDetail(null);detailsButton.current?.focus({preventScroll:true})}
        else if(mode==='focus')setView(v=>({...v,mode:'seated'}))
        else if(mode!=='walk'&&mode!=='seated')stand()
      }else if(k==='c'&&mode==='walk')game.current?.elevate()
      else if(k==='m'&&mode==='walk')setPanel('routes')
    }
    window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key)
  },[panel,mode,watching,near,arrive,remote,focus,showingDetails,showBottle])
  const close=()=>setPanel(null)
  const title=film?.title||'Out Of Office'
  return <main data-sumiyoshi data-area={area} data-mode={mode} data-renderer={renderer} data-selected-project={selected}
    onPointerDownCapture={()=>{tabNavigation.current=false}}
    data-tv-mode={showingDetails?(detail?.image===null?'overview':'gallery'):'cover'}
    className={s.game+' '+(watching?s.screening:'')}>
    <h1 className={s.sr}>Out Of Office · Sumiyoshi</h1>
    <div className={s.viewport} ref={host}/>
    {renderer!=='ready'&&<div className={s.fallback}>
      {film?.cover&&<Image fill sizes="100vw" src={film.cover.url} alt=""/>}
      <span role="status">{renderer==='loading'?'Opening the garden room…':'3D view unavailable'}
      {renderer==='off'&&<button onClick={()=>{setRenderer('loading');setRetry(x=>x+1)}}>Retry 3D</button>}</span>
    </div>}
    {showingDetails&&film&&detail&&<TVProject key={film.id} surface={surface} flat={renderer!=='ready'} film={film}
      details={info} number={film.index||folio(selected)} imageIndex={detail.image}
      selectImage={image=>setDetail({project:film.id,image})} step={stepImage}/>}
    <header className={s.header}>
      <div className={s.signature}><StudioLogo className={s.logo}/><div><b>Out Of Office</b><small>Sumiyoshi · 住吉</small></div></div>
      <div className={s.headButtons}>{mode==='walk'&&<button onClick={()=>setPanel('routes')}>Destinations <span>↗</span></button>}
        <button aria-label="Guide" className={s.help} onClick={()=>setPanel('guide')}>?</button></div>
    </header>
    {watching&&<>
      <div className={s.watchHud}>
        <div className={s.tvCaption}><small><i/> {mode==='focus'?'On screen':'Now showing'}</small><b>{title}</b></div>
        <div className={s.pills}>{mode==='seated'?<button onClick={focus}>Watch closely <span>↗</span></button>:<>
          {film&&<button ref={detailsButton} aria-expanded={showingDetails} onClick={()=>setDetail(showingDetails?null:{project:film.id,image:null})}>{showingDetails?'Back to cover':'Project details'}</button>}
          <button onClick={()=>{setDetail(null);setView(v=>({...v,mode:'seated'}))}}>Back to sofa</button></>}
          <button onClick={stand}>Stand up <kbd>Space</kbd></button></div>
      </div>
      <section className={s.tray} aria-label="Project arcade">
        <div className={s.trayBar}><div className={s.arcadeTitle}><i/> Project arcade <small>{folio(selected)} / {String(num).padStart(2,'0')}</small></div>
          <div className={s.remote} aria-label="TV remote"><button disabled={showingDetails?!imageCount:num<2} aria-label={showingDetails?'Previous gallery image':'Previous project'} onClick={()=>remote(-1)}>←</button>
          <button disabled={showingDetails?!imageCount:num<2} aria-label={showingDetails?'Next gallery image':'Next project'} onClick={()=>remote(1)}>→</button></div></div>
        <div className={s.strip} ref={filmstrip}>{projects.map((p,i)=>
          <button key={p.id} aria-label={folio(i)+' '+p.title} aria-pressed={i===selected} title={p.title} onClick={()=>{setDetail(null);setSelected(i)}} className={s.frame}>
            <span>{p.index||folio(i)}</span>{p.cover?<Image fill sizes="180px" src={p.cover.url} alt=""/>:<em>{p.title}</em>}
          </button>)}</div>
        {!num&&<p>{unavailable?'Project covers are currently unavailable.':'No projects in the programme yet.'}</p>}
      </section>
    </>}
    {mode==='walk'&&<div className={s.walkHud}>
      <div className={s.walkInfo}><small><i/>{placeNames[area]}</small><p aria-live="polite">{destination?'Walking to '+destinationName(destination):'Click to walk · WASD'}</p></div>
      <div className={s.pills}>{near&&<button className={s.primary} onClick={()=>arrive(near)}>{stops[near].action.kind==='member'?'Talk to ':''}{destinationName(near)} <kbd>Space</kbd></button>}
        <button onClick={()=>setPanel('routes')}>{area==='cafe'?'Meet the team':'Choose destination'} ↗</button>
        <button aria-label="Change camera height" onClick={()=>game.current?.elevate()}>View <kbd>C</kbd></button>
      </div>
    </div>}
    {mode==='talk'&&<Conversation key={member} person={person} index={member} done={stand}/>}
    {mode==='vendor'&&<section className={s.bubble} aria-label="VISION vending machine"><div className={s.dialogueTop}><small>VISION · Vending machine</small><button onClick={stand}>Done</button></div>
      <div className={s.offer}><div><h2>OOO Cola</h2><p>Studio vision printed on the label.</p></div><button className={s.solid} onClick={showBottle}>{hasCola?'Inspect your cola':'Take a cola'} ↗</button></div>
    </section>}
    {mode==='bottle'&&<div className={s.bottleControls}><div className={s.pills}>
      <button aria-label="Rotate bottle" onClick={()=>game.current?.turnBottle(Math.PI/3)}>Rotate ↻</button><button onClick={()=>setPanel('label')}>Read label</button>
      <button onClick={stand}>Done <kbd>Space</kbd></button></div></div>}
    {panel==='routes'&&<Sheet title={area==='cafe'?'Inside the Forest café':placeNames[area]} close={close}>
      <div className={s.routes}>{areas[area].stops.map(id=><button key={id} onClick={()=>travel(id)}><span>{destinationName(id)}</span>
        <small>{stops[id].action.kind==='member'?roles[Number(id.slice(7))]:'Walk here'}</small><b>↗</b></button>)}</div>
    </Sheet>}
    {panel==='label'&&<Sheet title="Studio vision" close={close}><div className={s.bottlePaper}><small>Out Of Office · OOO Cola</small><p>{vision||'Studio vision is currently unavailable.'}</p></div></Sheet>}
    {panel==='guide'&&<Sheet title="Sumiyoshi" close={close}><dl className={s.guide}>
      <dt>Garden room</dt><dd>Use the remote or the project strip to choose a cover. Watch closely and open Project details to read on the TV. In Gallery, swipe or use the arrows to browse photos. Esc returns to the cover.</dd>
      <dt>On foot</dt><dd>Click the floor or use WASD and the arrow keys. Press Space near a door, a seat or a person. C changes camera height.</dd>
      <dt>On the street</dt><dd>Forest café is the second house to the left of the concrete house. The VISION machine is to the right.</dd></dl>
      <nav className={s.directory}><Link href="/works">Works ↗</Link><Link href="/team">Team ↗</Link><Link href="/vision">Vision ↗</Link></nav>
    </Sheet>}
  </main>
}
