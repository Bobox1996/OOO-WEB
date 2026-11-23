'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import StudioLogo from '@/components/layout/StudioLogo'
import Image from '@/components/sections/PortfolioImage'
import { folio } from '@/lib/portfolio'
import type { TeamMember } from '@/types'
import type { Theatre } from './theatre'
import type { Mode, Stop } from './walking'
import { Cover, ProjectDeck, type Film } from './ProjectDeck'
import s from './drive-in.module.css'

type Member=Pick<TeamMember,'id'|'first_name'|'last_name'|'description'|'portrait_url'>
type Overlay='guide'|'programme'|'screen'|null
const stationNames:Record<Stop,string>={car:'Return to car',team:'TEAM booth',vision:'VISION machine'}

function Dialog({title,children,close,wide=false}:{title:string;children:ReactNode;close:()=>void;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null)
  useEffect(()=>{
    const el=ref.current!,previous=document.activeElement
    el.showModal()
    return ()=>{el.close();if(previous instanceof HTMLElement && previous.isConnected)previous.focus({preventScroll:true})}
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
  const [renderer,setRenderer]=useState<'loading'|'ready'|'off'>('loading')
  const host=useRef<HTMLDivElement>(null),engine=useRef<Theatre|null>(null),focusTarget=useRef<HTMLButtonElement>(null)
  const project=projects[index],member=members[person],seenMode=useRef<Mode>('cabin')
  const enter=useCallback((stop:Stop)=>{
    setWalkingTo(null);setMode(stop==='car'?'cabin':stop)
  },[])
  useEffect(()=>{
    let cancelled=false
    import('./theatre').then(({createTheatre})=>{
      if(cancelled||!host.current)return
      engine.current=createTheatre(host.current,{
        proximity:setNear,arrive:enter,enlarge:()=>setOverlay('screen'),
        failure:()=>{setRenderer('off');engine.current?.dispose();engine.current=null},
      })
      setRenderer('ready')
    }).catch(()=>{if(!cancelled)setRenderer('off')})
    return ()=>{cancelled=true;engine.current?.dispose();engine.current=null}
  },[enter])
  useEffect(()=>{engine.current?.setMode(mode)
    if(seenMode.current!==mode){focusTarget.current?.focus({preventScroll:true});seenMode.current=mode}
  },[mode,renderer])
  useEffect(()=>{engine.current?.project(project?.cover?.url??null,project?.title??'Intermission')},[project,renderer])
  useEffect(()=>{engine.current?.setMember(person)},[person,renderer])
  const select=useCallback((n:number)=>{if(projects.length)setIndex((n%projects.length+projects.length)%projects.length)},[projects.length])
  function travel(stop:Stop){
    if(engine.current && renderer==='ready'){setWalkingTo(stop);engine.current.travel(stop)}
    else enter(stop)
  }
  useEffect(()=>{
    function keyboard(e:KeyboardEvent){
      if(e.altKey||e.ctrlKey||e.metaKey||e.repeat||overlay)return
      const k=e.key.toLowerCase()
      if(k==='e'){
        if(mode==='cabin')setMode('lot')
        else if(mode==='lot'&&near)enter(near)
        else if(mode==='team'||mode==='vision')setMode('lot')
      }else if(k==='escape'&&(mode==='team'||mode==='vision'))setMode('lot')
      else if(mode==='cabin'&&(k==='arrowright'||k==='arrowleft')){e.preventDefault();select(index+(k==='arrowright'?1:-1))}
      else if(mode==='lot'&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))setWalkingTo(null)
    }
    window.addEventListener('keydown',keyboard);return ()=>window.removeEventListener('keydown',keyboard)
  },[mode,near,overlay,enter,index,select])
  const leaveStation=()=>{setWalkingTo(null);setMode('lot')}
  return <main data-drive-in className={s.game} data-mode={mode} data-renderer={renderer}>
    <h1 className={s.sr}>Out Of Office Drive-In Cinema</h1>
    <div className={s.stage} ref={host}/>
    {renderer!=='ready' && <div className={s.flatScene}>
      <div className={s.flatScreen}>{project?<Cover project={project} sizes="75vw"/>:<em>Intermission</em>}</div>
      <span>{renderer==='loading'?'Opening the cinema…':'Screening room'}</span></div>}
    <header className={s.header}>
      <div className={s.identity}><StudioLogo className={s.logo}/><span><strong>Out Of Office</strong><small>Drive-in cinema</small></span></div>
      <div className={s.headerTools}><span className={s.weather}><i aria-hidden="true">☂</i> Rain</span>
        <button className={s.guide} onClick={()=>setOverlay('guide')}><span aria-hidden="true">☰</span> Guide</button></div>
    </header>
    {mode==='cabin' && <>
      <div className={s.seat}>
        <div className={s.location}><i/> Driver’s seat</div>
        <button className={s.exit} ref={focusTarget} onClick={()=>setMode('lot')}>Step outside <span>↗</span></button>
      </div>
      <ProjectDeck projects={projects} index={index} select={select} program={()=>setOverlay('programme')}
        screen={()=>setOverlay('screen')} unavailable={unavailable}/>
    </>}
    {mode==='lot' && <div className={s.lotHud}>
      <div className={s.location}><i/> The parking lot</div>
      <p aria-live="polite">{walkingTo?'Walking to '+({team:'the TEAM booth',vision:'the VISION machine',car:'your car'}[walkingTo])+'…':
        renderer==='off'?'Choose a destination.':'Tap to walk or use the arrow keys.'}</p>
      {near && renderer==='ready' && <button className={s.near} onClick={()=>enter(near)}>{near==='team'?'Talk at the window':near==='vision'?'Use ticket machine':'Get in the car'} <kbd>E</kbd></button>}
      <nav aria-label="Walk to a destination">{(['team','vision','car'] as Stop[]).map((stop,i)=>
        <button key={stop} ref={i===0?focusTarget:undefined} onClick={()=>travel(stop)}>{stationNames[stop]} <span>↗</span></button>)}</nav>
    </div>}
    {mode==='team' && <section className={s.station} aria-label="Team window">
      <div className={s.stationBar}><span><i/> TEAM window</span><button ref={focusTarget} onClick={leaveStation}>Back to lot ↗</button></div>
      <div className={s.person} key={member?.id||'team'}>
        {member?.portrait_url && <div className={s.portrait}><Image fill sizes="70px" src={member.portrait_url} alt="" /></div>}
        <div><h2>{member?[member.first_name,member.last_name].filter(Boolean).join(' '):'Out Of Office'}</h2>
          <p>{member?.description||intro||(member?'Meet the studio at the TEAM window.':'The team directory is currently unavailable.')}</p></div>
      </div>
      {members.length>1 && <div className={s.memberFlip}><button aria-label="Previous team member" onClick={()=>setPerson((person-1+members.length)%members.length)}>←</button>
        <span>{folio(person)} / {String(members.length).padStart(2,'0')}</span><button aria-label="Next team member" onClick={()=>setPerson((person+1)%members.length)}>Next member →</button></div>}
    </section>}
    {mode==='vision' && <section className={s.station} aria-label="Vision ticket machine">
      <div className={s.stationBar}><span><i/> VISION machine</span><button ref={focusTarget} onClick={leaveStation}>Back to lot ↗</button></div>
      {issued?<article className={s.ticket}><div><small>OOO DRIVE-IN · ADMIT ONE</small><h2>Studio vision</h2><p>{vision||'The studio statement is currently unavailable.'}</p></div>
        <aside aria-hidden="true"><i/>OOO</aside></article>:<div className={s.vendor}><div><small>General admission</small><h2>One vision ticket</h2></div>
        <button onClick={()=>setIssued(true)}>Get ticket <span>Free ↗</span></button></div>}
    </section>}
    {overlay==='guide' && <Dialog title="Cinema guide" close={()=>setOverlay(null)}>
      <h2>Tonight at the drive-in</h2>
      <dl className={s.guideList}><dt>In the car</dt><dd>Flip through the project deck. Tap a cover to see it full size.</dd>
        <dt>In the lot</dt><dd>Walk with WASD, the arrow keys, or a tap. Choose a destination to walk there automatically.</dd>
        <dt>At the window</dt><dd>Meet the team at the booth or collect a free vision ticket at the machine.</dd></dl>
      <nav className={s.links} aria-label="Studio directory"><Link href="/works">Project index ↗</Link><Link href="/team">Team ↗</Link><Link href="/vision">Vision ↗</Link>
        <a href="mailto:office@out-of-office.design">Contact ↗</a><Link href="/app/login">App ↗</Link><Link href="/admin/login">Admin ↗</Link></nav>
    </Dialog>}
    {overlay==='programme' && <Dialog title="Project index" close={()=>setOverlay(null)}>
      <div className={s.programList}>{projects.map((p,i)=><button key={p.id} aria-pressed={i===index} onClick={()=>{select(i);setOverlay(null)}}>
        <span className={s.mini}><Cover project={p} sizes="84px"/></span><span><small>{p.index||folio(i)} / {p.category||'Project'}</small><strong>{p.title}</strong></span><b>↗</b></button>)}</div>
    </Dialog>}
    {overlay==='screen' && <Dialog title="Now showing" wide close={()=>setOverlay(null)}>{project?<>
      <div className={s.largeCover}><Cover project={project} sizes="92vw"/></div>
      <div className={s.filmTitle}><div><small>{project.index||folio(index)} / {project.category||'Project'}</small><h2>{project.title}</h2></div>
        <Link href={'/project/'+project.id}>Open project ↗</Link></div>
      </>:<h2>Intermission</h2>}</Dialog>}
    <noscript><div className={s.noScript}><Link href="/works">Browse projects</Link> · <Link href="/team">Team</Link> · <Link href="/vision">Vision</Link></div></noscript>
  </main>
}
