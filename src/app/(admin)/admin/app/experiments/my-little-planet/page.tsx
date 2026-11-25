'use client'
import { useEffect, useRef, useState } from 'react'
import type { SceneHandle } from './planet-view'
import type { BlockTool } from './terrain-blocks'
import { BLOCK_EDGE, BLOCK_HEIGHT, MIN_LAYER, MAX_LAYER, BlockKind, Category, label, variants } from './world'
import { specimenAtlas } from './specimen-atlas'
import styles from './study.module.css'

const categories:Category[]=['tree','rock','grass','sand','creek']
const en:Record<Category,string[]>={
  tree:['Coastal cypress','Silver birch','Windswept pine'],rock:['Granite boulder','Layered stone','River pebbles'],
  grass:['Coastal tuft','Flowering meadow','Golden sedge'],sand:['Fine sand','Shell sand','Wind-rippled sand'],creek:['Gentle bend','Double bend','Shallow reach']
}
const rule:Record<Category,string>={
  tree:'种在草坡或台地，每株占一格。',rock:'放在干燥的沙岸、草坡或台地。',grass:'在干地上种植一簇草甸。',sand:'在海岸和低台地变换沙面纹理。',creek:'点选一条已有溪流，替换它的水道形态。'
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
  orbit:'M12 3a9 9 0 1 0 9 9 M16 4h5v5 M21 4l-7 7',exit:'M5 5l14 14M19 5 5 19',
  walk:'M14 4a1.6 1.6 0 1 1-3.2 0A1.6 1.6 0 0 1 14 4z M9 11l3-4 3 5 4 1M12 8l-2 7-5 5m6-6 4 3 1 4',
  pin:'M19 10c0 4-7 11-7 11S5 14 5 10a7 7 0 1 1 14 0z M14 10a2 2 0 1 1-4 0 2 2 0 1 1 4 0'
}
function Icon({name,size=18}:{name:string;size?:number}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={shapes[name]} /></svg>
}
export default function LittlePlanet(){
  const canvas=useRef<HTMLCanvasElement>(null),api=useRef<SceneHandle|null>(null)
  const [kind,setKind]=useState<Category>('tree'),[variant,setVariant]=useState(0),[edit,setEdit]=useState(false),[grid,setGrid]=useState(false)
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[note,setNote]=useState(''),[history,setHistory]=useState(0),[ground,setGround]=useState(''),[backend,setBackend]=useState('')
  const [retry,setRetry]=useState(0)
  const [terrain,setTerrain]=useState(true),[tool,setTool]=useState<BlockTool>({material:'grass',action:'add',level:null})
  function switchPanel(blocks:boolean){setTerrain(blocks);setEdit(false);setNote('');setGround('')}
  const [walking,setWalking]=useState(false),[stick,setStick]=useState([0,0])
  useEffect(()=>{
    const ac=new AbortController();setReady(false);setError('')
    const el=canvas.current
    if(!el)return
    import('./planet-view').then(async m=>{
      if(ac.signal.aborted)return
      const handle=await m.mountPlanet(el,{note:setNote,history:setHistory,ground:setGround,walking:v=>{setWalking(v);setEdit(false);setGrid(false);setStick([0,0])},ready:(_,b)=>{setBackend(b);setReady(true)}},ac.signal)
      if(ac.signal.aborted)handle?.dispose();else api.current=handle
    }).catch(()=>{if(!ac.signal.aborted)setError('此浏览器未能建立 3D 画布。请启用图形加速，或在支持 WebGL 2 的浏览器中打开。')})
    return ()=>{ac.abort();api.current?.dispose();api.current=null}
  },[retry])
  useEffect(()=>{api.current?.choose({kind,variant,edit,tool:terrain?tool:null})},[kind,variant,edit,ready,terrain,tool])
  useEffect(()=>{api.current?.setGrid(grid)},[grid,ready])
  useEffect(()=>{if(!note)return;const id=window.setTimeout(()=>setNote(''),4600);return ()=>clearTimeout(id)},[note])
  const toggle=()=>{setEdit(!edit);setNote('')}
  const row=categories.indexOf(kind)
  function stickMove(e:React.PointerEvent<HTMLDivElement>){
    const b=e.currentTarget.getBoundingClientRect(),x=(e.clientX-b.left-b.width/2)/(b.width*.34),y=(e.clientY-b.top-b.height/2)/(b.height*.34),l=Math.max(1,Math.hypot(x,y))
    setStick([x/l,y/l]);api.current?.moveStick(x/l,-y/l)
  }
  function stickEnd(){setStick([0,0]);api.current?.moveStick(0,0)}
  return <div className={styles.app}>
    <header className={styles.top}><div className={styles.wordmark}><span className={styles.mark} aria-hidden="true"><i/><i/><i/></span>OUT OF OFFICE</div><span className={styles.topRule}/><span className={styles.small}>EXPERIMENTS</span><span className={styles.edition}>海岸原型 <b>0.3</b></span></header>
    <div className={styles.layout}>
      <section className={walking?styles.walkStage+' '+styles.stage:styles.stage} aria-label="可旋转的海岸星球">
        <div className={styles.heading}><div className={styles.kicker}>海岸地貌试作</div><h1>My Little Planet<span>.</span></h1></div>
        <div className={styles.canvasArea}>{!walking&&<div className={styles.shadow}/>}<canvas key={retry} ref={canvas} className={edit?styles.editCanvas:styles.canvas} tabIndex={0} aria-label={walking?'第三人称步行。WASD 或方向键移动，拖动环顾。':'星球。拖动旋转，方向键转动，加减号缩放。'} /></div>
        {walking&&<div className={styles.stick} role="group" aria-label="步行摇杆" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);stickMove(e)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))stickMove(e)}} onPointerUp={stickEnd} onPointerCancel={stickEnd} onLostPointerCapture={stickEnd}><span style={{transform:'translate('+stick[0]*19+'px,'+stick[1]*19+'px)'}}/></div>}
        {!ready&&<div className={styles.loader} role="status">{error||'正在生成海岸地形…'}{error&&<button onClick={()=>setRetry(r=>r+1)}>重试</button>}</div>}
        {note&&<div role="status" className={styles.toast}>{note}</div>}
        <div className={styles.viewportFoot}><div className={styles.views}><span className={styles.mode}><i/> {walking?'步行中':edit?(terrain?'地形编辑':'布置中'):'自由观察'}{ground&&!walking&&<em> / {ground}</em>}</span><button className={styles.walkButton} disabled={!ready} onClick={()=>{setNote('');api.current?.walk(!walking)}}><Icon name={walking?'orbit':'walk'} size={16}/>{walking?'返回全星':'步行探索'}</button></div>
        <div className={styles.tools}>
          <button title="缩小" aria-label="缩小" disabled={!ready} onClick={()=>api.current?.zoom(1.18)}><Icon name="minus"/></button><button title="放大" aria-label="放大" disabled={!ready} onClick={()=>api.current?.zoom(.84)}><Icon name="plus"/></button>{!walking&&<><span/><button title="全星视角" aria-label="全星视角" disabled={!ready} onClick={()=>api.current?.home()}><Icon name="home"/></button><button title="显示局部网格" aria-label="显示局部网格" aria-pressed={grid} disabled={!ready} onClick={()=>setGrid(v=>!v)}><Icon name="grid"/></button></>}
        </div></div>
      </section>
      <aside className={styles.panel}>
        {walking?<><div className={styles.panelHead}><div className={styles.kicker}>COASTAL WALK</div><h2>沿岸漫步</h2></div>
        <div className={styles.walkInstructions}><p><b>行走</b><span>W A S D / 方向键</span></p><p><b>小跑</b><span>Shift + 移动</span></p><p><b>环顾</b><span>拖动画面</span></p><p><b>触屏</b><span>左下摇杆移动，拖动右侧环顾</span></p></div>
        <div className={styles.walkAction}><p>相邻一层可沿坡行走，两层高差会挡住去路。你也可以在全星图选新落点。</p><button className={styles.placeBtn} onClick={()=>api.current?.landAt()}><Icon name="pin"/>选择落点</button></div></>:<>
        <div className={styles.panelSwitch} role="group" aria-label="编辑工具"><button aria-pressed={terrain} onClick={()=>switchPanel(true)}>地形块</button><button aria-pressed={!terrain} onClick={()=>switchPanel(false)}>环境标本</button></div>
        {terrain?<><div className={styles.panelHead}><div className={styles.kicker}>TERRAIN</div><h2>半高模块</h2></div>
        <div className={styles.blockTools}>
          <div className={styles.materials} role="group" aria-label="地形材料">{([['grass','草地块'],['sand','沙地块'],['water','水块']] as const).map(([m,n])=><button key={m} aria-pressed={tool.material===m} onClick={()=>setTool(t=>({...t,material:m as BlockKind}))}><span className={styles.blockChip} data-material={m} aria-hidden="true"><i/><b/><em/></span>{n}</button>)}</div>
          <div className={styles.blockActions} role="group" aria-label="方块操作">{([['add','增加'],['dig','挖去'],['paint','换材']] as const).map(([a,n])=><button key={a} aria-pressed={tool.action===a} onClick={()=>setTool(t=>({...t,action:a}))}>{n}</button>)}</div>
          <label className={styles.layerPick}>编辑层<select aria-label="编辑层" value={tool.level??'surface'} onChange={e=>setTool(t=>({...t,level:e.target.value==='surface'?null:Number(e.target.value)}))}><option value="surface">自动 · 表面</option>{Array.from({length:MAX_LAYER-MIN_LAYER+1},(_,i)=>MAX_LAYER-i).map(l=><option key={l} value={l}>第 {l} 层 · 顶面 {((l+1)*BLOCK_HEIGHT).toFixed(2)} m</option>)}</select></label>
          <p className={styles.blockHelp}>{tool.level===null?'点表层模块叠加、挖去或换材。选定层号可打开剖层，编辑内部或横向相邻的空格。':'剖层会临时隐藏上方模块。点选一格编辑当前层，回到「自动 · 表面」即可看完整星球。'}</p>
        </div>
        <div className={styles.action}><p>标称格宽 {BLOCK_EDGE.toFixed(2)} m，层高 {BLOCK_HEIGHT.toFixed(2)} m。</p><button className={styles.placeBtn} disabled={!ready} aria-pressed={edit} onClick={toggle}><Icon name={edit?'check':'place'}/>{edit?'完成编辑':'开始编辑'}</button><button className={styles.undo} disabled={!history} onClick={()=>api.current?.undo()}><Icon name="undo" size={15}/>撤销上一步</button></div></>:<>
        <div className={styles.panelHead}><div className={styles.kicker}>FIELD CATALOGUE</div><h2>环境标本</h2></div>
        <div className={styles.categories} role="group" aria-label="标本类别">{categories.map(k=><button key={k} aria-pressed={k===kind} onClick={()=>{setKind(k);setVariant(0);setNote('')}}><Icon name={k} size={21}/><span>{label[k]}</span></button>)}</div>
        <div className={styles.variants} role="group" aria-label={label[kind]+'模板'}>{variants[kind].map((v,i)=><button key={kind+i} aria-pressed={variant===i} onClick={()=>{setVariant(i);setNote('')}}>
          <span className={styles.thumb} aria-hidden="true" style={{backgroundImage:'url('+specimenAtlas+')',backgroundPosition:(i*50)+'% '+(row*25)+'%'}}/>
          <span className={styles.names}><strong>{v}</strong><small>{en[kind][i]}</small></span><span className={styles.radio}>{variant===i&&<Icon name="check" size={13}/>}</span>
        </button>)}</div>
        <div className={styles.action}><p>{rule[kind]}</p><button className={styles.placeBtn} disabled={!ready} aria-pressed={edit} onClick={toggle}><Icon name={edit?'check':'place'}/>{edit?'完成布置':kind==='creek'?'编辑水道':'开始布置'}</button>
        <button className={styles.undo} disabled={!history} onClick={()=>api.current?.undo()}><Icon name="undo" size={15}/>撤销上一步</button></div></>}</>}
      </aside>
    </div>
    <footer className={styles.foot}><span className={styles.desktopHint}>{walking?'WASD 行走　·　拖动环顾　·　Esc 返回全星':'拖动旋转　·　滚轮缩放　·　观察时双击靠近'}</span><span className={styles.touchHint}>{walking?'左侧摇杆行走　·　右侧拖动环顾':'单指旋转　·　双指缩放　·　布置时轻点地表'}</span><span title={backend}>{ready?'更改保存在此浏览器':'OOO / 在野实践'}</span></footer>
  </div>
}
