'use client'
import { useEffect, useRef, useState } from 'react'
import type { SceneHandle } from './planet-view'
import { Category, label, variants } from './world'
import { specimenAtlas } from './specimen-atlas'
import styles from './study.module.css'

const categories:Category[]=['tree','rock','grass','sand','creek']
const en:Record<Category,string[]>={
  tree:['Coastal cypress','Silver birch','Windswept pine'],rock:['Granite boulder','Layered stone','River pebbles'],
  grass:['Coastal tuft','Flowering meadow','Golden sedge'],sand:['Fine sand','Shell sand','Wind-rippled sand'],creek:['Gentle bend','Double bend','Shallow reach']
}
const rule:Record<Category,string>={
  tree:'种在草坡或台地，每株占一格。',rock:'放在干燥的沙岸、草坡或台地。',grass:'在干地上种植一簇草甸。',sand:'在海岸和低台地铺一片沙地。',creek:'点选一条已有溪流，替换它的水道形态。'
}
const shapes:Record<string, string>={
  tree:'M12 3c-2 0-4 2-4 4-3 0-5 3-4 5 0 2 2 3 5 3h6c4 0 6-2 5-5 0-2-2-4-4-4-1-2-2-3-4-3z M12 15v6m-3 0h6',
  rock:'m3 15 4-8 7-3 7 10-4 5H6z M7 7l5 6 9 1 M12 13l-2 6',
  grass:'M4 19c2-6 4-9 5-10m1 10c0-7 1-11 4-15m0 15c1-4 3-7 7-10M4 20h16',
  sand:'M2 11c4-3 6 1 10-1s6-3 10-1M2 16c4-3 6 1 10-1s6-3 10-1M5 6h1m7-2h1m5 16h1',
  creek:'M15 2c-9 4-12 7-6 10 7 3 5 5-3 10M20 2c-10 6-11 7-6 9 8 4 5 8-1 11',
  grid:'M3 4h18v16H3z M9 4v16m6-16v16M3 10h18m-18 5h18',home:'M3 10V4h6m6 0h6v6m0 4v6h-6m-6 0H3v-6',
  plus:'M5 12h14m-7-7v14',minus:'M5 12h14',undo:'M9 5 3 10l6 5M4 10h9c6 0 8 4 7 8',
  place:'m5 20 3-7L17 4l3 3-9 9z M14.5 6.5l3 3',check:'m4 12 5 5L20 6',
  orbit:'M12 3a9 9 0 1 0 9 9 M16 4h5v5 M21 4l-7 7',exit:'M5 5l14 14M19 5 5 19'
}
function Icon({name,size=18}:{name:string;size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={shapes[name]} /></svg>
}
export default function LittlePlanet(){
  const canvas=useRef<HTMLCanvasElement>(null),api=useRef<SceneHandle|null>(null)
  const [kind,setKind]=useState<Category>('tree'),[variant,setVariant]=useState(0),[edit,setEdit]=useState(false),[grid,setGrid]=useState(false)
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[note,setNote]=useState(''),[history,setHistory]=useState(0),[ground,setGround]=useState(''),[backend,setBackend]=useState('')
  const [retry,setRetry]=useState(0)
  useEffect(()=>{
    const ac=new AbortController();setReady(false);setError('')
    const el=canvas.current
    if(!el)return
    import('./planet-view').then(async m=>{
      if(ac.signal.aborted)return
      const handle=await m.mountPlanet(el,{note:setNote,history:setHistory,ground:setGround,ready:(_,b)=>{setBackend(b);setReady(true)}},ac.signal)
      if(ac.signal.aborted)handle?.dispose();else api.current=handle
    }).catch(()=>{if(!ac.signal.aborted)setError('此浏览器未能建立 3D 画布。请启用图形加速，或在支持 WebGL 2 的浏览器中打开。')})
    return ()=>{ac.abort();api.current?.dispose();api.current=null}
  },[retry])
  useEffect(()=>{api.current?.choose({kind,variant,edit})},[kind,variant,edit,ready])
  useEffect(()=>{api.current?.setGrid(grid)},[grid,ready])
  useEffect(()=>{if(!note)return;const id=window.setTimeout(()=>setNote(''),4600);return ()=>clearTimeout(id)},[note])
  const toggle=()=>{setEdit(!edit);setNote('')}
  const row=categories.indexOf(kind)
  return <div className={styles.app}>
    <header className={styles.top}><div className={styles.wordmark}><span className={styles.mark} aria-hidden="true"><i/><i/><i/></span>OUT OF OFFICE</div><span className={styles.topRule}/><span className={styles.small}>EXPERIMENTS</span><span className={styles.edition}>环境原型 <b>0.1</b></span></header>
    <div className={styles.layout}>
      <section className={styles.stage} aria-label="可旋转的海岸星球">
        <div className={styles.heading}><div className={styles.kicker}>海岸地貌试作</div><h1>My Little Planet<span>.</span></h1></div>
        <div className={styles.canvasArea}><div className={styles.shadow}/><canvas key={retry} ref={canvas} className={edit?styles.editCanvas:styles.canvas} tabIndex={0} aria-label="星球。拖动旋转，方向键转动，加减号缩放。" /></div>
        {!ready&&<div className={styles.loader} role="status">{error||'正在生成海岸地形…'}{error&&<button onClick={()=>setRetry(r=>r+1)}>重试</button>}</div>}
        {note&&<div role="status" className={styles.toast}>{note}</div>}
        <div className={styles.viewportFoot}><span className={styles.mode}><i/> {edit?'布置中':'自由观察'}{ground&&<em> / {ground}</em>}</span>
        <div className={styles.tools}>
          <button title="缩小" aria-label="缩小" disabled={!ready} onClick={()=>api.current?.zoom(1.18)}><Icon name="minus"/></button><button title="放大" aria-label="放大" disabled={!ready} onClick={()=>api.current?.zoom(.84)}><Icon name="plus"/></button><span/><button title="全星视角" aria-label="全星视角" disabled={!ready} onClick={()=>api.current?.home()}><Icon name="home"/></button><button title="显示局部网格" aria-label="显示局部网格" aria-pressed={grid} disabled={!ready} onClick={()=>setGrid(v=>!v)}><Icon name="grid"/></button>
        </div></div>
      </section>
      <aside className={styles.panel}>
        <div className={styles.panelHead}><div className={styles.kicker}>FIELD CATALOGUE</div><h2>环境标本</h2></div>
        <div className={styles.categories} role="group" aria-label="标本类别">{categories.map(k=><button key={k} aria-pressed={k===kind} onClick={()=>{setKind(k);setVariant(0);setNote('')}}><Icon name={k} size={21}/><span>{label[k]}</span></button>)}</div>
        <div className={styles.variants} role="group" aria-label={label[kind]+'模板'}>{variants[kind].map((v,i)=><button key={kind+i} aria-pressed={variant===i} onClick={()=>{setVariant(i);setNote('')}}>
          <span className={styles.thumb} aria-hidden="true" style={{backgroundImage:'url('+specimenAtlas+')',backgroundPosition:(i*50)+'% '+(row*25)+'%'}}/>
          <span className={styles.names}><strong>{v}</strong><small>{en[kind][i]}</small></span><span className={styles.radio}>{variant===i&&<Icon name="check" size={13}/>}</span>
        </button>)}</div>
        <div className={styles.action}><p>{rule[kind]}</p><button className={styles.placeBtn} disabled={!ready} aria-pressed={edit} onClick={toggle}><Icon name={edit?'check':'place'}/>{edit?'完成布置':kind==='creek'?'编辑水道':'开始布置'}</button>
        <button className={styles.undo} disabled={!history} onClick={()=>api.current?.undo()}><Icon name="undo" size={15}/>撤销上一步</button></div>
      </aside>
    </div>
    <footer className={styles.foot}><span className={styles.desktopHint}>拖动旋转　·　滚轮缩放　·　观察时双击靠近</span><span className={styles.touchHint}>单指旋转　·　双指缩放　·　布置时轻点地表</span><span title={backend}>{ready?'更改保存在此浏览器':'OOO / 在野实践'}</span></footer>
  </div>
}

