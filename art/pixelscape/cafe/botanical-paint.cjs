// Native pixel artwork. The eight 64px studies are sampled by bent leaves in Blender.
// The continuous garden across four panes uses the same drawing vocabulary at a distance.
const path = require('node:path')
const sharp = require('sharp')

const greens = ['152e34','1b403e','27554a','35664d','497b55','659363','86a66c','b1bd86']
function brush(width,height) {
  const data=Buffer.alloc(width*height*4)
  const palette=new Map()
  function dot(x,y,c) {
    x=Math.round(x); y=Math.round(y)
    if (x<0 || x>=width || y<0 || y>=height) return
    if (!palette.has(c)) palette.set(c,Buffer.from(c+'ff','hex'))
    palette.get(c).copy(data,4*(width*y+x))
  }
  function line(x,y,X,Y,c) {
    const n=Math.max(1,Math.ceil(Math.hypot(X-x,Y-y)))
    for(let i=0;i<=n;i++) dot(x+(X-x)*i/n,y+(Y-y)*i/n,c)
  }
  return {dot,line,save:file=>sharp(data,{raw:{width,height,channels:4}}).png({palette:true,colors:128,dither:0}).toFile(path.join(__dirname,file+'.png'))}
}
function rng(seed) {
  return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0; return seed/4294967296}
}
function leafAtlas() {
  const s=brush(256,128)
  const random=rng(409267)
  for(let cell=0;cell<8;cell++) {
    const left=(cell%4)*64, top=Math.floor(cell/4)*64
    const dot=(x,y,c)=>s.dot(left+x,top+y,c)
    const line=(x,y,X,Y,c)=>s.line(left+x,top+y,left+X,top+Y,c)
    if(cell===4 || cell===5) {
      // Polystichum pinnae and a black pine shoot, each anchored to one central rachis.
      const pine=cell===5
      if(pine)for(let row=11;row<=58;row++){
        const half=13*Math.sin(Math.PI*(row-9)/53)**.7
        const centre=30+Math.sin((60-row)/58*3)*4
        for(let col=Math.ceil(centre-half);col<=centre+half;col++){
          const band=Math.sin(row*.39+Math.abs(col-centre)*.43)
          dot(col,row,greens[(col>centre?3:2)+(band>.30?1:0)])
        }
      }
      for(let y=3;y<=61;y++) {
        const t=(60-y)/58
        const mid=30+Math.sin(t*3)*4
        dot(mid,y,pine?'947c57':'91a675')
        dot(mid-1,y,pine?'544e3e':'435f46')
        if((pine && y%2===0)||(!pine && y%4===0)){
          for(const side of [-1,1]){
            const dx=Math.sin(Math.PI*Math.max(.01,t))**.57 * (pine?27:26)
            const yy=y-(pine?10:5)-random()*4
            const col=greens[(side<0?3:4)+Math.floor(random()*3)]
            line(mid,y,mid+side*dx,yy,col)
            if(pine) line(mid+side*4,y-1,mid+side*(dx*.82),yy-3,greens[3+Math.floor(random()*3)])
            else for(let p=2;p<dx;p+=3) {
              const by=y+(yy-y)*p/dx
              line(mid+side*p,by,mid+side*(p+3.5),by-3,col)
              line(mid+side*p,by+1,mid+side*(p+2),by+2,greens[3])
            }
          }
        }
      }
      continue
    }
    for(let y=2;y<62;y++){
      const t=(61-y)/59, mid=30+(cell===3?2:3.5)*Math.sin(t*4-.4)
      let width=Math.sin(Math.PI*Math.pow(t,cell===0?.88:cell===2?.79:1.08))
      width=Math.pow(Math.max(0,width),cell===7?.46:.80)*(cell===6?12:cell===3?14:cell===0?23:25)
      for(let x=Math.ceil(mid-width);x<=mid+width;x++){
        const side=(x-mid)/Math.max(1,width)
        const vein=Math.abs(((t*50+Math.abs(side)*5)%6)-3)
        const fleck=Math.sin(Math.floor(x/3)*3.4+Math.floor(y/3)*1.97)
        let index=(side<0?3:4)+(Math.abs(side)>.86?-1:0)+(vein<.65 && Math.abs(side)<.88?1:0)
        if(cell===1 && ((Math.abs(side)>.58+Math.sin(t*14)*.15 && vein<2.7) || (side<-.22 && fleck>.82)))index+=2
        if(cell===7 && Math.sin(t*40+Math.abs(side)*3)>0 && Math.abs(side)>.16)index-=1
        if(side>.70 && t>.36 && t<.85)index+=1
        if(fleck>.91 && Math.abs(side)<.8)index+=1
        let c=greens[Math.min(7,Math.max(0,index))]
        if(cell===6)c=['8a9775','aeb597','c7c9a3','e0daba','f8e7bc'][Math.max(0,Math.min(4,index-2))]
        if(Math.abs(x-mid)<.8 && t<.87)c=cell===6?'dbbd77':cell===2?'83a181':'91a975'
        dot(x,y,c)
      }
    }
  }
  return s.save('botanical-leaves')
}
function rainGarden() {
  const w=448,h=196,s=brush(w,h),random=rng(9405)
  const sky=['334762','384f69','425a72','4b6980','527587','5b7d88']
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)s.dot(x,y,sky[Math.min(5,Math.floor(6*y/h+(random()-.5)*.18))])
  // Garden beyond the glazing: neighbours softened by mist, clouded canopy, a few occupied rooms.
  for(let x=-5;x<w;){
    const width=19+Math.floor(random()*39),y=64+Math.floor(random()*32)
    for(let yy=y;yy<h;yy++)s.line(x,yy,x+width,yy,'344e62')
    s.line(x-2,y,x+width+2,y,'2e4559')
    for(let yy=y+8;yy<161;yy+=13)for(let xx=x+5;xx<x+width-2;xx+=10){
      const col=random()>.78?['c3a283','b69d80','cdb995'][Math.floor(random()*3)]:'415c6b'
      for(let j=0;j<4;j++)s.line(xx,yy+j,xx+3,yy+j,col)
    }
    x+=width+2
  }
  const depthColors=[['294957','365961','416565','517776'],['213d47','2d514c','40665a','557963'],['172f39','24413e','345849','51705a']]
  for(let layer=0;layer<3;layer++){
    const col=depthColors[layer]
    function twig(x,y,a,len,depth){
      const xx=x+Math.cos(a)*len, yy=y+Math.sin(a)*len
      s.line(x,y,xx,yy,col[0]);if(depth<2)s.line(x+1,y,xx+1,yy,col[0])
      if(depth>=2)for(let i=0;i<24;i++){
        const ax=xx+(random()-.5)*18,ay=yy+(random()-.5)*11
        const c=col[Math.max(1,Math.min(3,Math.floor(2+(yy-ay)*.14+random()*.9)))]
        s.line(ax,ay,ax+2+random()*4,ay-1,c);s.line(ax+1,ay+1,ax+3,ay+1,c)
      }
      if(depth<4){twig(xx,yy,a-.34-random()*.38,len*.74,depth+1);twig(xx,yy,a+.23+random()*.44,len*.69,depth+1)}
    }
    const roots=layer===0?[-10,56,109,173,258,312,383,465]:layer===1?[-13,47,154,267,355,454]:[-12,73,240,402,465]
    for(const x of roots)twig(x,h+random()*15,-1.65+(random()-.5)*.7,35+random()*24,0)
  }
  for(let i=0;i<75;i++){
    const x=random()*w,y=random()*h
    const c=y>110?'738888':'718a9a'
    s.dot(x,y,c);if(random()<.38)s.line(x,y+1,x-.3,y+3+random()*3,c)
  }
  return s.save('rain-garden-window')
}
async function studioPrints() {
  // Two plates from OOO's actual Forest-Wanna-Be House gallery: the cutaway axonometric
  // and the measured drawing sheet. Preserve their aspect ratios and compose cropped
  // studies of the house in two inks on the same paper.
  const publicDir=path.join(__dirname,'../../../public/sumiyoshi/projects')
  const plateSpecs=[
    ['80315267-98a2-4f06-9a83-72b01672dca7',[316,120,1144,952]],
    ['474ca1fc-18d6-47be-831b-acfc875d0021',[303,47,571,566]]
  ]
  const s=brush(448,210)
  for(let i=0;i<plateSpecs.length;i++){
    const [file,[left,top,width,height]]=plateSpecs[i]
    const filePath=path.join(publicDir,file+'.webp')
    const {data}=await sharp(filePath).extract({left,top,width,height}).flatten({background:'white'})
      .resize(199,171,{fit:'contain',background:'white'}).greyscale().raw().toBuffer({resolveWithObject:true})
    const ink=i?['d7c8a2','baa981','958664','796f53','5d5849','4a4840']:['c7c9b2','a9b5a6','8a9e91','6e847c','536b65','3b534f']
    for(let y=0;y<210;y++)for(let x=0;x<224;x++){
      let c=ink[0]
      if(x>=12&&x<211&&y>=12&&y<183){
        const light=data[(y-12)*199+x-12]/255
        c=ink[Math.min(5,Math.floor((1-Math.pow(light,3.9))*6))]
      }
      s.dot(i*224+x,y,c)
    }
    s.line(i*224+13,187,i*224+208,187,ink[2])
    for(let j=0;j<4;j++)s.line(i*224+14+j*8,192,i*224+19+j*8,192,ink[4])
    s.line(i*224+183,193,i*224+207,193,ink[3])
  }
  await s.save('forest-studio-prints')
}
module.exports=()=>Promise.all([leafAtlas(),rainGarden(),studioPrints()])
