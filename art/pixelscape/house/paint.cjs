// The rain court is painted at the intended sample size. All operations below
// write integral pixels. Each exported PNG is a separate, editable paint layer.
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const out = path.join(__dirname, 'paint')
fs.mkdirSync(out, {recursive:true})
let state = 0x86d00
function random() { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
const range = (a,b) => a + (b-a)*random()
const int = (a,b) => Math.floor(range(a,b+1))
const choose = a => a[int(0,a.length-1)]
const clamp = (x,a,b) => Math.max(a,Math.min(b,x))
const rgb = s => [parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16),255]
const palette = a => a.split(' ').map(rgb)
function raster(w,h) {
  const data = Buffer.alloc(w*h*4)
  function dot(x,y,col) {
    x = Math.floor(x); y = Math.floor(y)
    if(x<0||x>=w||y<0||y>=h)return
    const at = (x+y*w)*4
    for(let i=0;i<4;i++)data[at+i]=col[i]
  }
  function rect(x,y,dx,dy,c) {
    for(let j=Math.max(0,Math.floor(y));j<Math.min(h,Math.ceil(y+dy));j++)
      for(let i=Math.max(0,Math.floor(x));i<Math.min(w,Math.ceil(x+dx));i++)dot(i,j,c)
  }
  function poly(points,c) {
    const y0 = clamp(Math.ceil(Math.min(...points.map(p=>p[1]))),0,h-1)
    const y1 = clamp(Math.ceil(Math.max(...points.map(p=>p[1]))),0,h)
    for(let y=y0;y<y1;y++){
      const xs=[]
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length]
        if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]))
      }
      xs.sort((a,b)=>a-b)
      for(let i=0;i+1<xs.length;i+=2){for(let x=Math.ceil(xs[i]);x<xs[i+1];x++)dot(x,y,c)}
    }
  }
  function line(x,y,u,v,c,th=1) {
    const n=Math.max(1,Math.ceil(Math.max(Math.abs(x-u),Math.abs(y-v))))
    for(let i=0;i<=n;i++)rect(Math.round(x+(u-x)*i/n),Math.round(y+(v-y)*i/n),th,th,c)
  }
  function oval(x,y,rx,ry,c) {
    for(let j=Math.floor(y-ry);j<=Math.ceil(y+ry);j++){
      const radius=rx*Math.sqrt(Math.max(0,1-((j-y)/ry)**2))
      for(let i=Math.ceil(x-radius);i<=x+radius;i++)dot(i,j,c)
    }
  }
  return {w,h,dot,rect,line,poly,oval,save(name){return sharp(data,{raw:{width:w,height:h,channels:4}}).png({palette:true,colors:128,dither:0}).toFile(path.join(out,name+'.png'))}}
}
function skyline(){
  const m=raster(1056,320)
  const bands=palette('607eab 607eaa 5e7ea8 597ca6 587aa4 577b9f 55799d 527697 507594 4c708e')
  for(let i=0;i<bands.length;i++)m.rect(0,i*32,1056,32,bands[i])
  for(let j=0;j<75;j++){
    const x=int(-90,1050),y=int(0,165),w=int(12,100),h=int(2,7),c=bands[Math.floor(y/32)+1]
    m.poly([[x,y],[x+w*.25,y-2],[x+w,y],[x+w*.8,y+h],[x+w*.15,y+h]],c)
  }
  for(let k=0;k<3;k++){
    const height=x=>112+21*k+Math.sin(x*.012+k)*15+Math.sin(x*.027+3*k)*7+Math.sin(x*.047)*3
    const pts=[]
    for(let x=-3;x<1065;x+=3)pts.push([x,height(x)+range(-1.5,1.5)])
    m.poly([...pts,[1060,321],[-3,321]],palette('577595 4b688a 405c77')[k])
  }
  // Neighbouring apartment backs and service balconies, observed past the garden.
  const far=palette('4a6380 536b87 59708b 405975 4d6685 596a81')
  for(let x=-15;x<1070;){
    const w=int(22,68),floors=int(2,6),y=191-floors*10+int(-10,8),c=choose(far)
    m.rect(x,y,w,211-y,c);m.rect(x-1,y-2,w+2,2,far[3]);m.rect(x+w*.67,y-6,7,5,far[2])
    for(let j=0;j<floors;j++)for(let i=3;i<w-4;i+=9)
      m.rect(x+i,y+j*10+4,4,4,random()<.038?rgb('ceb881'):choose(far))
    x+=w+int(0,7)
  }
  function block(x,y,w,h,floors,style){
    const wall=palette(style?'515469 474b60 3e4255 333f52 525e77':'435972 526983 374e68 465a71 4b647e')
    const shade=rgb('283c52'),rail=rgb('405573'),trim=rgb('536c88')
    m.rect(x,y,w,320-y,wall[0]);m.rect(x+w*.76,y,w*.24,320-y,wall[2])
    m.rect(x-2,y-3,w+4,4,shade);m.rect(x,y-5,w,2,trim)
    if(w>84){m.rect(x+8,y-13,22,11,wall[1]);m.rect(x+5,y-14,28,2,shade)}
    const level=Math.floor(h/floors),bays=Math.max(3,Math.round(w/15)),bw=w/bays
    for(let j=0;j<floors;j++){
      const wy=y+j*level+5
      for(let i=0;i<bays;i++){
        const xx=Math.round(x+i*bw+3),ww=Math.round(bw*.57),hh=Math.max(4,Math.floor(level*.46))
        m.rect(xx-1,wy-1,ww+2,hh+2,wall[4]);m.rect(xx,wy,ww,hh,shade)
        const lit=random()<.14
        if(lit){
          const colors=choose([palette('b48a62 dec18b 94745d'),palette('a8a98d d5c898 897d69'),palette('a07d73 cca083 7a6265')])
          m.rect(xx+1,wy+1,ww-2,hh-2,colors[0]);m.rect(xx+1,wy+1,Math.max(2,ww*.35),hh-2,colors[1])
          m.rect(xx+ww-3,wy+1,2,hh-2,colors[2]);m.rect(xx+Math.floor(ww*.5),wy,1,hh,wall[1])
          if(random()<.5)m.rect(xx,wy+2,ww,1,colors[2])
        }else{m.rect(xx+1,wy+2,ww*.48,hh-3,wall[2]);m.rect(xx+ww-3,wy+1,1,hh-1,rail)}
        m.rect(xx-1,wy+hh+1,ww+2,1,trim)
        if(j%3===1&&i%2===0){m.rect(xx+ww+1,wy+hh-3,4,3,wall[4]);m.line(xx+ww+4,wy+hh,xx+ww+4,wy+level,shade)}
      }
      if(style||j%2===1){
        m.rect(x+2,wy+level-5,w*.69,3,wall[1]);m.rect(x+1,wy+level-7,w*.69,1,rail)
        for(let x1=x+3;x1<x+w*.69;x1+=7)m.rect(x1,wy+level-7,1,4,rail)
        m.rect(x,wy+level-2,w*.73,2,shade)
      }
    }
    m.rect(x+w-7,y+2,1,h-2,trim)
    // Antennas occupy a few deliberate pixels at the roofline.
    const px=x+w*.6
    m.line(px,y-3,px,y-17,rail);m.line(px-6,y-12,px+5,y-14,rail);m.line(px-4,y-10,px+6,y-12,rail)
  }
  const blocks=[[-16,116,105,128,7,0],[104,137,96,93,5,1],[224,99,111,141,7,0],[347,128,86,111,6,1],[442,155,103,91,5,0],[552,115,93,129,7,1],[655,130,117,101,5,0],[777,94,88,154,8,0],[872,123,110,121,6,1],[991,145,84,93,5,0]]
  blocks.forEach(b=>block(...b))
  for(const [x,y] of [[193,109],[685,128],[906,106]]){
    m.rect(x,y,2,206,rgb('3c526c'));m.rect(x-7,y+9,16,2,rgb('39536d'))
    for(let j=0;j<2;j++){
      for(let i=0;i<360;i++){
        const yy=y+11+j*3+Math.sin(i/365*Math.PI)*8-i*.013
        m.dot(i+x,yy,rgb('405572'))
      }
    }
  }
  return m.save('distant-nagaya')
}
function washi(){
  const m=raster(144,128)
  const p=palette('926440 ae794d c28f5b d4a46d deb47c e9c58a f0d396 f5dda7')
  for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){
    const bend=(1+Math.cos((x-19)/144*Math.PI*2))*.5
    const crown=Math.sin((y+2)/133*Math.PI)
    const density=.8+3.15*bend+2.62*crown+.09*Math.sin(y*1.15)+range(-.2,.28)
    const rib=(y+1)%11
    const n=clamp(Math.floor(density-(rib===0?1.8:rib===1?.65:0)),0,7)
    m.dot(x,y,p[n])
  }
  for(let i=0;i<190;i++){
    const x=int(0,143),y=int(0,127),c=p[int(2,6)]
    if((y+1)%11>2)m.line(x,y,x+int(1,4),y,c)
  }
  return m.save('lit-washi')
}
function gardenStone(){
  const m=raster(192,128),p=palette('364649 414e50 4b5652 596159 56624e 69745a 7b8369 929280')
  m.rect(0,0,192,128,p[2])
  for(let i=0;i<370;i++){
    const x=int(-9,194),y=int(-1,134),len=int(2,23)
    m.poly([[x,y],[x+len,y-int(0,2)],[x+len-2,y+2],[x+1,y+2]],p[int(0,3)])
  }
  for(let i=0;i<85;i++){
    const x=int(1,190),y=int(-3,127),r=range(2,9)
    for(let j=0;j<16;j++){
      const ex=x+range(-r,r),ey=y+range(-r*.35,r*.35)
      m.rect(ex,ey,int(1,4),int(1,2),choose([p[4],p[4],p[5],p[6]]))
    }
  }
  for(let j=0;j<410;j++)m.dot(int(0,191),int(0,127),choose([p[1],p[5],p[6],p[7]]))
  return m.save('garden-andesite')
}
function materialSheet(name,base,kind){
  const m=raster(192,128),c=palette(base)
  m.rect(0,0,m.w,m.h,c[1])
  if(kind==='wood'){
    for(let y=0;y<128;y+=2){
      const x=int(-20,190),len=int(9,130),k=choose(c),amp=range(.3,1.8)
      for(let i=0;i<len;i++)m.dot((x+i+192)%192,y+amp*Math.sin(i*.048),k)
    }
    for(let y=0;y<128;y+=32){m.rect(0,y,192,1,c[0]);m.rect(0,y+1,192,1,c[2])}
  }else if(kind==='fabric'){
    for(let y=0;y<128;y+=2)for(let x=0;x<192;x+=4){const offset=(Math.floor(y/2)%2)*2;m.rect(x+offset,y,2,1,random()<.32?c[0]:c[2])}
  }else{
    for(let i=0;i<1700;i++)m.rect(int(0,191),int(0,127),int(1,4),1,choose(c))
    for(let i=0;i<14;i++){const xx=int(0,191),yy=int(0,127);for(let j=0;j<int(8,26);j++)m.dot((xx+j)%192,(yy+Math.floor(j*.36))%128,c[0])}
  }
  return m.save(name)
}
Promise.all([
  skyline(), require('./botanical-plates.cjs')(), washi(),
  gardenStone(),
  materialSheet('charred-cedar','253030 3c4341 434944 50514a','wood'),
  materialSheet('oiled-walnut','362c2a 514138 665143 725641','wood'),
  materialSheet('linen-weave','626962 696e67 70766e','fabric'),
  materialSheet('thermal-basalt','343f42 465154 4b5656 515b59','stone'),
]).catch(err=>{console.error(err);process.exitCode=1})
