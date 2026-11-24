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
  const bands=palette('397780 34747d 30737b 2b707b 296e7a 266c78 226774 216572 1d626e 205e68')
  for(let i=0;i<bands.length;i++)m.rect(0,i*32,1056,32,bands[i])
  for(let j=0;j<75;j++){
    const x=int(-90,1050),y=int(0,165),w=int(12,100),h=int(2,7),c=bands[Math.floor(y/32)+1]
    m.poly([[x,y],[x+w*.25,y-2],[x+w,y],[x+w*.8,y+h],[x+w*.15,y+h]],c)
  }
  for(let k=0;k<3;k++){
    const height=x=>112+21*k+Math.sin(x*.012+k)*15+Math.sin(x*.027+3*k)*7+Math.sin(x*.047)*3
    const pts=[]
    for(let x=-3;x<1065;x+=3)pts.push([x,height(x)+range(-1.5,1.5)])
    m.poly([...pts,[1060,321],[-3,321]],palette('306978 295e6c 24545f')[k])
  }
  // Neighbouring apartment backs and service balconies, observed past the garden.
  const far=palette('2b5761 305b64 335c64 28505b 315e65 375c60')
  for(let x=-15;x<1070;){
    const w=int(22,68),floors=int(2,6),y=191-floors*10+int(-10,8),c=choose(far)
    m.rect(x,y,w,211-y,c);m.rect(x-1,y-2,w+2,2,far[3]);m.rect(x+w*.67,y-6,7,5,far[2])
    for(let j=0;j<floors;j++)for(let i=3;i<w-4;i+=9)
      m.rect(x+i,y+j*10+4,4,4,random()<.038?rgb('a99b6d'):choose(far))
    x+=w+int(0,7)
  }
  function block(x,y,w,h,floors,style){
    const wall=palette(style?'51494a 42464a 3a4044 383a3c 485354':'37555c 3e5d60 274a54 3c4e52 355258')
    const shade=rgb('283c43'),rail=rgb('395158'),trim=rgb('42616a')
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
          const colors=choose([palette('b18a55 d3af6e 8b7656'),palette('a8a98d d5c898 897d69'),palette('917562 bb8e67 736551')])
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
    m.rect(x,y,2,206,rgb('35525a'));m.rect(x-7,y+9,16,2,rgb('324f56'))
    for(let j=0;j<2;j++){
      for(let i=0;i<360;i++){
        const yy=y+11+j*3+Math.sin(i/365*Math.PI)*8-i*.013
        m.dot(i+x,yy,rgb('344f55'))
      }
    }
  }
  return m.save('distant-nagaya')
}
// Build a lobed silhouette, then group directional leaves in darker pockets
// and moonlit crown planes. The empty cuts between boughs remain transparent.
function wooded(name,kind){
  const m=raster(320,272)
  const shade=kind==='back'?palette('14363f 183e43 1f4949 285453 306059 3b6b63'):
    kind==='pine'?palette('102f34 123d3f 164844 20594e 2b6b57 458568'):
    palette('123638 17413e 195042 28634d 357b56 599469')
  const bark=palette('132c30 263a36 425047 5d5f4a')
  const tufts=[]
  function limb(x,y,angle,length,width,order){
    const bend=range(-.17,.17),mid=[x+Math.cos(angle)*length*.48,y+Math.sin(angle)*length*.48]
    const end=[mid[0]+Math.cos(angle+bend)*length*.52,mid[1]+Math.sin(angle+bend)*length*.52]
    const n=[-Math.sin(angle)*width/2,Math.cos(angle)*width/2]
    m.poly([[x+n[0],y+n[1]],[mid[0]+n[0]*.81,mid[1]+n[1]*.81],[end[0]+n[0]*.57,end[1]+n[1]*.57],[end[0]-n[0]*.6,end[1]-n[1]*.6],[mid[0]-n[0]*.82,mid[1]-n[1]*.82],[x-n[0],y-n[1]]],bark[order>1?1:0])
    if(width>3){m.line(x+n[0]*.64,y+n[1]*.64,mid[0]+n[0]*.60,mid[1]+n[1]*.60,bark[2],Math.max(1,Math.floor(width*.18)))}
    if(order===0) {tufts.push([...end,range(9,19),range(5,12)]);return}
    const sides=kind==='pine'?[-1,1]:[-1,1,0]
    for(const s of sides){
      const direction=clamp(angle+s*range(.44,.86),-3.03,-.13)
      limb(end[0],end[1],direction,length*range(.60,.76),width*.6,order-1)
    }
    if(order<3)tufts.push([...mid,range(7,13),range(6,10)])
  }
  if(kind==='pine'){
    const spine=[[121,283],[143,235],[162,211],[146,182],[171,150],[169,126],[190,96],[181,61],[196,44]]
    for(let i=0;i<spine.length-1;i++){
      const [x,y]=spine[i],[u,v]=spine[i+1],wi=12-i
      m.poly([[x-wi,y],[u-wi+2,v],[u+wi-2,v],[x+wi,y]],bark[1]);m.line(x-wi+2,y,u-wi+4,v,bark[2],Math.max(1,Math.floor(wi/3)))
      if(i>0)for(const side of [-1,1]){
        const leftReach=[0,1,.71,1.03,.48,1.04,.82,.51],rightReach=[0,.48,1.08,.45,.87,.55,.95,.61]
        const spread=((8-i)*14+8)*(side<0?leftReach[i]:rightReach[i]),x1=u+side*spread,y1=v-range(2,21)
        m.poly([[u-2,v+3],[u+side*spread*.48,v-3],[x1,y1-2],[x1,y1],[u+side*spread*.5,v+4],[u+2,v+8]],bark[1])
        for(let j=1;j<5;j++)tufts.push([u+(x1-u)*j/4,v+(y1-v)*j/4-range(3,12),range(12,25),range(4,9)])
      }
    }
  }else{limb(157,279,-1.62,64,11,4);limb(155,245,-2.06,49,8,3);limb(157,221,-.89,51,7,3)}
  function canopy(x,y,rx,ry){
    // Larger shadow families span multiple branches. Leaves only catch a sharp
    // moon edge over the upper-left quarter of an exposed crown.
    const pocket = Math.sin(.055*x+.073*y) + .6*Math.cos(.018*x-.105*y)
    const dark = (pocket<.30?1:0)+(kind==='back'&&pocket<-.25?1:0)
    const ink=n=>shade[clamp(n-dark,0,5)]
    const centers=[]
    for(let j=0;j<9;j++){const t=range(0,Math.PI*2);centers.push([x+Math.cos(t)*rx*.62,y+Math.sin(t)*ry*.58,rx*range(.28,.63),ry*range(.34,.78)])}
    for(const [xx,yy,a,b] of centers)m.oval(xx,yy,a,b,shade[0])
    for(const [xx,yy,a,b] of centers){
      m.oval(xx-1,yy-1,a*.95,b*.76,ink(1));m.oval(xx-a*.17,yy-b*.45,a*.71,b*.43,ink(2))
      for(let i=0;i<6;i++){
        const ex=xx+range(-.82,.76)*a,ey=yy+range(-.74,.24)*b,sw=range(2,5)
        const c=ink(random()<.18?4:3)
        m.poly([[ex-sw,ey+1],[ex-1,ey-1],[ex+sw,ey-1],[ex+sw-1,ey],[ex,ey+2]],c)
        if(random()<.12&&pocket>.55)m.line(ex-2,ey-1,ex+int(0,2),ey-2,ink(5))
      }
    }
  }
  tufts.sort((a,b)=>a[1]-b[1]);tufts.forEach(t=>canopy(...t))
  return m.save(name)
}
// Broad near-field leaves are considerably larger than the darkest canopy
// marks. Stems, folded faces, stepped margins and highlights read independently.
function camellia(){
  const m=raster(280,190)
  const p=palette('102d31 173b37 20493a 2c5943 406e4e 5c845b 719969')
  const bark=palette('233937 405346 58674f'),ends=[]
  function blade(x,y,length,angle,tone){
    const a=[Math.cos(angle),Math.sin(angle)],b=[-a[1],a[0]],w=length*range(.16,.21)
    const pt=(s,t)=>[x+length*s*a[0]+w*t*b[0],y+length*s*a[1]+w*t*b[1]]
    m.poly([pt(0,0),pt(.24,-.69),pt(.43,-1),pt(.70,-.83),pt(.9,-.34),pt(1.04,-.10),
      pt(.91,.14),pt(.71,.67),pt(.49,.94),pt(.23,.65)],p[tone])
    m.poly([pt(0,0),pt(.26,-.62),pt(.47,-.95),pt(.72,-.77),pt(.87,-.39),pt(1.01,-.10),pt(.62,-.02),pt(.30,.13)],p[Math.min(6,tone+1)])
    if(tone>2){
      m.line(...pt(.13,.06),...pt(.69,-.04),p[Math.min(6,tone+2)])
      if(length>13)m.line(...pt(.45,-.82),...pt(.64,-.7),p[Math.min(6,tone+2)])
    }
  }
  function fork(x,y,a,len,width,l){
    const b=a+range(-.3,.3),xx=x+Math.cos(b)*len,yy=y+Math.sin(b)*len
    m.line(x,y,xx,yy,bark[0],Math.max(1,width));if(width>2)m.line(x+1,y,xx,yy,bark[1])
    if(l){
      fork(xx,yy,clamp(b+range(-.58,-.10),-3.13,-.10),len*range(.54,.73),width*.65,l-1)
      fork(xx,yy,clamp(b+range(.18,.59),-3.13,-.10),len*range(.60,.79),width*.7,l-1)
    }
    if(l<=2)ends.push([x,y,xx,yy,b,len,l])
  }
  for(const [x,y,a,len] of [[85,193,-1.6,48],[115,203,-2.12,53],[127,199,-.88,56],[84,198,-2.51,41],[149,192,-.48,44]])fork(x,y,a,len,4,3)
  ends.sort((a,b)=>a[1]-b[1])
  for(const [x,y,xx,yy,a,len,l] of ends){
    for(let j=1;j<5;j++){
      const t=j*.22
      const e=x+(xx-x)*t,f=y+(yy-y)*t,hi=Math.sin(e*.035-f*.058)>.3
      const tone=hi?int(2,4):int(0,2)
      blade(e,f,range(10,21)*(1+l*.07),a+(j%2?1:-1)*range(.5,1.25),tone)
    }
  }
  return m.save('camellia-branches')
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
function groundCover(){
  const m=raster(256,144),pal=palette('123b34 184a37 236040 398052 559261 82a974')
  for(let group=0;group<32;group++){
    const x=range(15,240),y=range(88,143),size=range(14,48)
    for(let i=0;i<10;i++){
      const angle=range(-2.87,-.20),width=range(2,4),len=size*range(.62,1)
      const x1=x+Math.cos(angle)*len,y1=y+Math.sin(angle)*len
      m.line(x,y,x1,y1,pal[2])
      for(let j=0;j<9;j++){
        const t=(j+1)/10,xx=x+(x1-x)*t,yy=y+(y1-y)*t,v=(1-t*.64)*len*.22
        for(const side of [-1,1]){
          const an=angle+side*.92,ex=xx+Math.cos(an)*v,ey=yy+Math.sin(an)*v
          m.poly([[xx,yy],[ex,ey],[xx+Math.cos(an)*v*.52+2,yy+Math.sin(an)*v*.52+width]],pal[1+Math.floor(3*random())])
          if(side<0&&random()<.52)m.line(xx+(ex-xx)*.5,yy+(ey-yy)*.5,ex,ey,pal[int(3,5)])
        }
      }
    }
  }
  return m.save('fern-bank')
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
  skyline(),wooded('black-pine','pine'),wooded('rain-maple','maple'),wooded('blue-oak','back'),groundCover(),camellia(),washi(),
  gardenStone(),
  materialSheet('charred-cedar','253030 3c4341 434944 50514a','wood'),
  materialSheet('oiled-walnut','362c2a 514138 665143 725641','wood'),
  materialSheet('linen-weave','626962 696e67 70766e','fabric'),
  materialSheet('thermal-basalt','343f42 465154 4b5656 515b59','stone'),
]).catch(err=>{console.error(err);process.exitCode=1})
