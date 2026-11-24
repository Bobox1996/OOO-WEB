'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import StudioLogo from '@/components/layout/StudioLogo'
import Image from '@/components/sections/PortfolioImage'
import { folio } from '@/lib/portfolio'
import type { TeamMember } from '@/types'
import type { Theatre } from './theatre'
import { memberStops, type Mode, type Stop } from './walking'
import { Cover, ProjectDeck, type Film } from './ProjectDeck'
import s from './drive-in.module.css'

type Member=Pick<TeamMember,'id'|'first_name'|'last_name'|'description'|'portrait_url'>
type Overlay='guide'|'programme'|'screen'|'deck'|'directory'|null
const roles=['Checkout clerk','Stock clerk','Shopper · pantry aisle','Shopper · daily goods','Shopper · cold drinks','Shopper · newsstand','Shopper · entrance']
const places={car:'Your car',team:'TEAM store',vision:'VISION machine',exit:'Store exit'}
const areaNames:Record<Mode,string>={cabin:'Driver’s seat',lot:'Screening field',shop:'TEAM convenience store',team:'TEAM convenience store',vision:'VISION ticket machine'}
function nameOf(member:Member|undefined,i:number){return [member?.first_name,member?.last_name].filter(Boolean).join(' ')||'Member '+folio(i)}
function Modal({title,children,close,wide=false}:{title:string;children:ReactNode;close:()=>void;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{
    const el=ref.current!,previous=document.activeElement
    el.showModal()
    return ()=>{el.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true})}
  },[])
  return <dialog className={s.dialog+' '+(wide?s.wide:'')} ref={ref} aria-label={title}
    onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===ref.current)close()}}>
    <div className={s.dialogBody}><div className={s.dialogHead}><span>{title}</span><button autoFocus onClick={close} aria-label="Close">×</button></div>{children}</div>
  </dialog>
}

export default function DriveIn({projects,members,vision,intro,unavailable}:{
  projects:Film[];members:Member[];vision:string|null;intro:string|null;unavailable:boolean
}){
  const [mode,setMode]=useState<Mode>('cabin'),[overlay,setOverlay]=useState<Overlay>(null)
  const [index,setIndex]=useState(0),[person,setPerson]=useState(0),[issued,setIssued]=useState(false)
  const [near,setNear]=useState<Stop|null>(null),[walkingTo,setWalkingTo]=useState<Stop|null>(null)
  const [renderer,setRenderer]=useState<'loading'|'ready'|'off'>('loading'),[retry,setRetry]=useState(0)
  const host=useRef<HTMLDivElement>(null),engine=useRef<Theatre|null>(null),focusTarget=useRef<HTMLButtonElement>(null)
  const seenMode=useRef<Mode>('cabin'),count=useRef(projects.length)
  const project=projects[index],member=members[person]
  useEffect(()=>{count.current=projects.length},[projects.length])
  const flip=useCallback((by:number)=>{setIndex(n=>count.current?(n+by+count.current)%count.current:0)},[])
  const enter=useCallback((stop:Stop)=>{
    setWalkingTo(null);setOverlay(null)
    if(stop==='car')setMode('cabin')
    else if(stop==='vision')setMode('vision')
    else if(stop==='team')setMode('shop')
    else if(stop==='exit')setMode('lot')
    else {setPerson(Number(stop.slice(7)));setMode('team')}
  },[])
  useEffect(()=>{
    let cancelled=false
    const fallback=(reason:string)=>{
      if(cancelled)return
      console.warn('Cinema preview:',reason)
      engine.current?.dispose();engine.current=null;setRenderer('off')
    }
    import('./theatre').then(({createTheatre})=>{
      if(cancelled||!host.current)return
      engine.current=createTheatre(host.current,{
        proximity:setNear,arrive:enter,enlarge:()=>setOverlay('screen'),deck:()=>setOverlay('deck'),flip,
        ready:()=>{if(!cancelled)setRenderer('ready')},failure:fallback,
      })
    }).catch(e=>fallback(String(e)))
    return ()=>{cancelled=true;engine.current?.dispose();engine.current=null}
  },[enter,flip,retry])
  useEffect(()=>{
    engine.current?.setMember(person);engine.current?.setMode(mode)
    if(seenMode.current!==mode){focusTarget.current?.focus({preventScroll:true});seenMode.current=mode}
  },[mode,person,renderer])
  useEffect(()=>{engine.current?.project(projects,index)},[projects,index,renderer])
  useEffect(()=>{engine.current?.pause(!!overlay)},[overlay,renderer])
  const select=(n:number)=>{if(projects.length)setIndex((n%projects.length+projects.length)%projects.length)}
  function travel(stop:Stop){
    setOverlay(null)
    if(engine.current&&renderer==='ready'){setWalkingTo(stop);engine.current.travel(stop)}
    else enter(stop)
  }
  function place(stop:Stop){return stop in places?places[stop as keyof typeof places]:nameOf(members[Number(stop.slice(7))],Number(stop.slice(7)))}
  function action(stop:Stop){
    if(stop==='car')return 'Get in the car'
    if(stop==='team')return 'Enter TEAM store'
    if(stop==='vision')return 'Use VISION machine'
    if(stop==='exit')return 'Step outside'
    return 'Talk to '+place(stop)
  }
  useEffect(()=>{
    function keyboard(e:KeyboardEvent){
      if(e.altKey||e.ctrlKey||e.metaKey||e.repeat||overlay)return
      const k=e.key.toLowerCase()
      if(k==='e'){
        if(mode==='cabin')setMode('lot')
        else if((mode==='lot'||mode==='shop')&&near)enter(near)
        else if(mode==='team')setMode('shop')
        else if(mode==='vision')setMode('lot')
      }else if(k==='escape'&&mode==='team')setMode('shop')
      else if(k==='escape'&&mode==='vision')setMode('lot')
      else if(mode==='cabin'&&(k==='arrowright'||k==='arrowleft')){e.preventDefault();flip(k==='arrowright'?1:-1)}
      else if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))setWalkingTo(null)
    }
    window.addEventListener('keydown',keyboard);return ()=>window.removeEventListener('keydown',keyboard)
  },[mode,near,overlay,enter,flip])
  const close=()=>setOverlay(null)
  return <main data-drive-in className={s.game} data-mode={mode} data-renderer={renderer}>
    <h1 className={s.sr}>Out Of Office Drive-In Cinema</h1>
    <div className={s.stage} ref={host}/>
    {renderer!=='ready'&&<div className={s.flatScene} role="status">
      <div className={s.flatScreen}>{project?<Cover project={project} sizes="75vw"/>:<em>OOO Drive-In</em>}</div>
      <span>{renderer==='loading'?'Opening the cinema…':'3D scene unavailable'}</span>
      {renderer==='off'&&<button className={s.guide} onClick={()=>{setRenderer('loading');setRetry(n=>n+1)}}>Reload scene</button>}
    </div>}
    <header className={s.header}>
      <div className={s.identity}><StudioLogo className={s.logo}/><span><strong>Out Of Office</strong><small>Drive-in cinema</small></span></div>
      <div className={s.headerTools}><span className={s.weather}><i aria-hidden="true">☂</i> Rain</span>
        <button className={s.guide} onClick={()=>setOverlay('guide')}>Guide <span aria-hidden="true">?</span></button></div>
    </header>
    {mode==='cabin'&&<div className={s.seat}>
      <div className={s.location}><i/> {areaNames.cabin}</div>
      <div className={s.commands}><button className={s.exit} ref={focusTarget} onClick={()=>setMode('lot')}>Step outside <kbd>E</kbd></button>
        <button className={s.quiet} onClick={()=>setOverlay('deck')}>Project deck <span>↗</span></button></div>
    </div>}
    {(mode==='lot'||mode==='shop')&&<div className={s.lotHud}>
      <div className={s.location}><i/>{areaNames[mode]}</div>
      <p aria-live="polite">{walkingTo?'Walking to '+place(walkingTo)+'…':renderer==='off'?'Choose a destination.':'Click to walk · WASD / arrow keys'}</p>
      {near&&renderer==='ready'&&<button className={s.near} onClick={()=>enter(near)}>{action(near)} <kbd>E</kbd></button>}
      {mode==='lot'?<nav aria-label="Walk to a destination">{(['team','vision','car'] as const).map((stop,i)=>
        <button key={stop} ref={i===0?focusTarget:undefined} onClick={()=>travel(stop)}>{place(stop)} <span>↗</span></button>)}</nav>:
      <nav aria-label="Store actions"><button ref={focusTarget} onClick={()=>setOverlay('directory')}>Meet the team <span>↗</span></button>
        <button onClick={()=>travel('exit')}>Walk to exit <span>↗</span></button></nav>}
    </div>}
    {mode==='team'&&<section className={s.station} aria-label="Member conversation">
      <div className={s.stationBar}><span><i/> {roles[person]}</span><button ref={focusTarget} onClick={()=>setMode('shop')}>End conversation <kbd>E</kbd></button></div>
      <div className={s.person} key={member?.id||person}>
        {member?.portrait_url&&<div className={s.portrait}><Image fill sizes="70px" src={member.portrait_url} alt=""/></div>}
        <div><small className={s.hello}>Hello, I’m</small><h2>{nameOf(member,person)}</h2>
          <p>{member?.description?.trim()==='CEO'?'I’m the CEO. Welcome to our little night store.':member?.description||(member?'Welcome to the TEAM store.':'The studio directory is currently unavailable.')}</p></div>
      </div>
    </section>}
    {mode==='vision'&&<section className={s.station} aria-label="Vision ticket machine">
      <div className={s.stationBar}><span><i/> VISION machine</span><button ref={focusTarget} onClick={()=>setMode('lot')}>Back to lot ↗</button></div>
      {issued?<article className={s.ticket}><div><small>OOO DRIVE-IN · ADMIT ONE</small><h2>Studio vision</h2><p>{vision||'The studio statement is currently unavailable.'}</p></div>
        <aside aria-hidden="true"><i/>OOO</aside></article>:<div className={s.vendor}><div><small>General admission</small><h2>One vision ticket</h2></div>
        <button onClick={()=>setIssued(true)}>Get ticket <span>Free ↗</span></button></div>}
    </section>}
    {overlay==='directory'&&<Modal title="Store directory" close={close}>
      <div className={s.directory}>{memberStops.map((stop,i)=><button key={stop} onClick={()=>travel(stop)}>
        <span>{folio(i)}</span><div><b>{nameOf(members[i],i)}</b><small>{roles[i]}</small></div><b>↗</b></button>)}</div>
    </Modal>}
    {overlay==='guide'&&<Modal title="Cinema guide" close={close}>
      <h2>Tonight at the drive-in</h2>
      <dl className={s.guideList}><dt>In the car</dt><dd>Tap the dashboard to browse projects. The arrow keys change the projection. Tap the cinema screen to enlarge it. Drag the windshield to look around.</dd>
        <dt>Outside</dt><dd>Walk with WASD, arrow keys or a tap. Choose a destination to walk there. Press E when you reach it.</dd>
        <dt>In the store</dt><dd>Tap any of the seven people to walk over and talk. The store directory can also guide you to them.</dd>
        <dt>At VISION</dt><dd>Use the ticket machine to collect a ticket with the studio’s vision.</dd></dl>
      {intro&&<p className={s.studioIntro}>{intro}</p>}
      <nav className={s.links} aria-label="Studio directory"><Link href="/works">Project index ↗</Link><Link href="/team">Team ↗</Link><Link href="/vision">Vision ↗</Link>
        <a href="mailto:office@out-of-office.design">Contact ↗</a><Link href="/app/login">App ↗</Link><Link href="/admin/login">Admin ↗</Link></nav>
    </Modal>}
    {overlay==='deck'&&<Modal title="Vehicle touchscreen" close={close}>
      <ProjectDeck projects={projects} index={index} select={select} program={()=>setOverlay('programme')} screen={()=>setOverlay('screen')} unavailable={unavailable}/>
    </Modal>}
    {overlay==='programme'&&<Modal title="Project index" close={close}>
      <div className={s.programList}>{projects.map((p,i)=><button key={p.id} aria-pressed={i===index} onClick={()=>{select(i);setOverlay('deck')}}>
        <span className={s.mini}><Cover project={p} sizes="84px"/></span><span><small>{p.index||folio(i)} / {p.category||'Project'}</small><strong>{p.title}</strong></span><b>↗</b></button>)}</div>
    </Modal>}
    {overlay==='screen'&&<Modal title="Now showing" wide close={close}>{project?<>
      <div className={s.largeCover}><Cover project={project} sizes="92vw"/></div>
      <div className={s.filmTitle}><div><small>{project.index||folio(index)} / {project.category||'Project'}</small><h2>{project.title}</h2></div>
        {project.cover?.url.startsWith('/drive-in/content/')?
          <a href={'https://ooo-web.vercel.app/project/'+encodeURIComponent(project.id)} target="_blank" rel="noreferrer">Open project ↗</a>:
          <Link href={'/project/'+project.id}>Open project ↗</Link>}</div>
      </>:<h2>Intermission</h2>}</Modal>}
    <noscript><div className={s.noScript}><Link href="/works">Browse projects</Link> · <Link href="/team">Team</Link> · <Link href="/vision">Vision</Link></div></noscript>
  </main>
}
