// Paint the shop signs, stock and building finishes at their game resolution.
// Run with Node from the portfolio checkout. PNGs can also be touched up by hand.
const sharp = require('sharp')
const path = require('node:path')
let state = 86741232
function rand(n) { state = (Math.imul(state,1664525) + 1013904223) >>> 0; return Math.floor(state / 4294967296 * n) }
const palette = {}
function color(s) {
  if (!palette[s]) palette[s] = [0,2,4].map(i=>parseInt(s.slice(i,i+2),16)).concat(s.length>6?parseInt(s.slice(6,8),16):255)
  return palette[s]
}
function sheet(w,h,bg) {
  const data=Buffer.alloc(w*h*4)
  function rect(x,y,dx,dy,c) {
    const rgba=color(c)
    for(let j=Math.max(0,Math.floor(y));j<Math.min(h,Math.floor(y+dy));j++)
      for(let i=Math.max(0,Math.floor(x));i<Math.min(w,Math.floor(x+dx));i++)data.set(rgba,(j*w+i)*4)
  }
  function line(x,y,xx,yy,c,width=1) {
    const steps=Math.max(1,Math.abs(xx-x),Math.abs(yy-y))
    for(let k=0;k<=steps;k++)rect(Math.round(x+(xx-x)*k/steps),Math.round(y+(yy-y)*k/steps),width,width,c)
  }
  rect(0,0,w,h,bg)
  return {rect,line,save:(name)=>sharp(data,{raw:{width:w,height:h,channels:4}}).png({palette:true,colors:180}).toFile(path.join(__dirname,name+'.png'))}
}
const alphabet={
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],
  C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],
  G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','00010','10010','01100'],
  K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','11001','10101','10011','10011','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],
  R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],
  T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],
  V:['10001','10001','10001','10001','01010','01010','00100'],W:['10001','10001','10001','10101','10101','11011','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'],
  '/':['00001','00010','00010','00100','01000','01000','10000'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['11110','00001','00001','01110','10000','10000','11111'],'4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110']
}
function type(s,x,y,word,c,size=1,track=1) {
  for(const ch of word){const letter=alphabet[ch];if(letter)letter.forEach((row,j)=>[...row].forEach((v,i)=>{if(v==='1')s.rect(x+i*size,y+j*size,size,size,c)}));x+=(ch===' '?3:5)*size+track}
}
const jobs=[]
function store(s,n){jobs.push(s.save(n))}
jobs.push(require('./botanical-paint.cjs')())

{
  const s=sheet(186,28,'0c2928')
  s.rect(0,0,186,1,'718375');s.rect(0,1,186,1,'264749');s.rect(0,25,186,2,'172d2a');s.rect(0,27,186,1,'977744')
  s.rect(5,5,1,17,'b8aa74');s.rect(180,5,1,17,'b8aa74')
  type(s,20,7,'FOREST HOUSE','dddebd',2,2)
  store(s,'marquee')
}
{
  const s=sheet(80,62,'26382f')
  s.rect(1,1,78,60,'b99a68');s.rect(2,2,76,58,'273b30');type(s,9,8,'COFFEE BAR','f9dfac')
  s.rect(8,19,64,1,'baa377')
  for(const [i,label,price] of [[0,'HOUSE','550'],[1,'FILTER','650'],[2,'LATTE','650'],[3,'TOAST','750']]){
    type(s,9,24+8*i,label,'daccab');type(s,53,24+8*i,price,'edd09c')
  }
  store(s,'menu')
}
const palettes=[
  ['9e4a3e','c7744e','efbd83','836e52','b19058'],['6d9177','aac190','eee2b6','498f84','cbbf94'],
  ['ebcfaa','c2b28e','d4a158','f2ddb1','c76b50'],['668e9e','98adab','d4d5ac','618176','a85a4c']
]
{
  // Four shelf bays share a sheet. Packages are painted individually, grouped by SKU.
  const s=sheet(256,80,'372d2b')
  for(let bay=0;bay<4;bay++){
    const left=bay*64
    for(let row=0;row<3;row++){
      const base=25+row*24
      s.rect(left+1,base-20,62,20,['8c775c','817153','998061'][row]);s.rect(left+2,base-18,60,16,'ab916b')
      for(let q=0;q<12;q++)s.rect(left+2+rand(59),base-16+rand(13),1+rand(4),1,'a08361')
      let x=left+3
      while(x<left+59){
        const group=2+rand(3),series=palettes[(bay+row+rand(3))%4],pkg=series[rand(series.length)],kind=rand(4),width=kind===3?6:3+rand(4),height=9+rand(8)
        for(let t=0;t<group&&x+width<left+63;t++,x+=width+1){
          const top=base-height
          if(kind===0){s.rect(x+1,top+1,width-2,2,pkg);s.rect(x,top+4,width,height-4,pkg);s.rect(x+1,top+3,width-2,2,pkg);s.rect(x+1,top,width-2,2,'585841')}
          else if(kind===1){s.rect(x,top+2,width,height-2,pkg);s.rect(x+1,top,width-2,3,pkg);s.rect(x+1,top+1,width-2,1,'d6ba91')}
          else {s.rect(x,top,width,height,pkg);s.rect(x,top,width,1,'dfcaa4')}
          s.rect(x+width-1,top+3,1,height-3,'826953');s.rect(x,base-2,width,1,'a38e6a')
          s.rect(x+1,top+Math.floor(height/2),Math.max(1,width-2),2,['e6d7af','513f37','96704d'][kind%3])
          if(width>4)s.rect(x+2,top+Math.floor(height/2)+3,width-3,1,'6f6956')
        }
      }
      s.rect(left,base,64,1,'f8d59b');s.rect(left,base+1,64,3,'786650');s.rect(left+8+rand(10),base+1,6,2,'e3d9a9');s.rect(left+40,base+1,9,2,'d0bd91')
    }
    s.rect(left,0,2,80,'48473a');s.rect(left+2,2,1,74,'d5bc91')
  }
  store(s,'stock')
}
{
  // Mostly translucent flutes, interrupted by a broad muted band and fine ribs.
  const s=sheet(96,80,'c7d5c8c4')
  for(let x=0;x<96;x+=6){s.rect(x,0,1,80,'dfe7d5e8');s.rect(x+1,0,2,80,'b4c8bfcb');s.rect(x+3,0,1,80,'849e99bd')}
  for(let n=0;n<68;n++)s.rect(rand(96),rand(79),1+rand(2),1+rand(7),'a9c2b9c0')
  store(s,'flutes')
}
{
  const s=sheet(128,96,'704535')
  for(let i=0;i<4;i++){
    const x=i*32;s.rect(x,0,32,96,['83553d','82543e','845741','76503e'][i]);s.rect(x,0,1,96,'52392f');s.rect(x+1,0,1,96,'aa7854')
    for(let j=0;j<23;j++){const p=x+2+rand(27),q=rand(93);s.rect(p,q,1,2+rand(17),['865b42','906248','79513e','9a6b4b'][rand(4)])}
    const xx=x+5+rand(12),yy=15+rand(55)
    s.line(xx,yy-10,xx+2,yy-3,'674837');s.line(xx+2,yy-2,xx+1,yy+5,'674837');s.line(xx+4,yy-8,xx+5,yy-1,'986b4e')
  }
  store(s,'walnut')
}
{
  const s=sheet(96,96,'5f4d45')
  for(let j=0;j<4;j++)for(let i=0;i<4;i++){
    const x=i*24,y=j*24
    s.rect(x+1,y+1,23,23,['825547','886052','7b5145','795147','8b6150','805748'][rand(6)])
    s.rect(x+2,y+2,21,1,'95705d')
    for(let k=0;k<14;k++)s.rect(x+2+rand(20),y+3+rand(18),1+rand(3),1,['8e6858','785448','896351'][rand(3)])
  }
  store(s,'clinker')
}
{
  // The studio's own front photograph supplies three distinct crown silhouettes.
  // Crop coordinates are measured on an 820px proof of the 1600px published photograph.
  const source=path.join(__dirname,'../../../public/sumiyoshi/projects/ea3c78eb-4977-434a-8172-5fabb61804fc.webp')
  const crowns=[
    [205,27,176,204,[[82,6],[117,0],[164,9],[174,46],[154,92],[134,110],[134,147],[101,157],[98,195],[32,203],[14,167],[0,101],[11,77],[67,95],[89,85]]],
    [414,44,196,185,[[2,121],[23,86],[66,69],[76,2],[112,0],[139,17],[177,8],[194,39],[180,73],[144,95],[121,152],[110,180],[46,184],[34,154],[11,151]]],
    [581,139,112,122,[[2,93],[8,56],[34,47],[43,26],[78,3],[107,5],[105,31],[79,63],[78,89],[58,122],[12,119]]]
  ]
  function inside(x,y,v){let hit=false;for(let i=0,j=v.length-1;i<v.length;j=i++){const [a,b]=v[i],[c,d]=v[j];if(((b>y)!==(d>y))&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit}return hit}
  const leaf=['142e37','1e4045','294e4a','365e51','477158','628360','78996d','9cad76','b0ba86']
  jobs.push((async()=>{
    // Keep 1.5x the original proof resolution. Cluster the colours using a lightly averaged
    // luminance; saturated leaf edges stay transparent instead of inheriting the white sky.
    const scale=1.5
    const {data,info}=await sharp(source).resize({width:820*scale}).removeAlpha().raw().toBuffer({resolveWithObject:true})
    for(let i=0;i<crowns.length;i++){
      const [px,py,pw,ph,polygon]=crowns[i]
      const left=Math.round(px*scale),top=Math.round(py*scale),width=Math.round(pw*scale),height=Math.round(ph*scale)
      const s=sheet(width,height,'00000000')
      const pigments=new Int8Array(width*height).fill(-1)
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        if(!inside((x+.5)/scale,(y+.5)/scale,polygon))continue
        const ix=((top+y)*info.width+left+x)*3,r=data[ix],g=data[ix+1],b=data[ix+2]
        if((g>b*1.13+4 && g>r*.84 && r<g*1.21+6 && g<208) || (g<64 && g>b+3 && r<g+14)){
          const local=(data[ix+4]+data[ix-2]+data[ix+info.width*3+1])/3
          const value=g*.70+r*.15+local*.15
          const index=Math.max(0,Math.min(8,Math.floor((value-11)/19.5)))
          pigments[y*width+x]=index
        }
      }
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        let index=pigments[y*width+x]
        // The real road has utility wires crossing the photographed foliage. Interpolate
        // narrow interrupted leaf clusters here; the street supplies its own wires in 3D.
        const sy=(top+y)/scale,sx=(left+x)/scale
        const wire=[144-.020*sx,129-.032*sx,132-.012*sx,142-.010*sx].some(line=>Math.abs(line-sy)<2.5)
        if(wire&&index<1&&y>=4&&y<height-4){
          const a=pigments[(y-4)*width+x],b=pigments[(y+4)*width+x]
          if(a>=1&&b>=1)index=(x+y)%3?b:a
        }
        if(index>=0)s.rect(x,y,1,1,leaf[index])
      }
      await s.save('crown-'+i)
    }
  })())
}
{
  // Sharp/camera resolution cannot resolve individual millimetre holes at street distance.
  // Give the mesh a larger diffuse value, a muted staggered hole and partial transmittance.
  const s=sheet(32,32,'c1d1c5dc')
  for(let y=0;y<32;y+=8)for(let x=-8;x<32;x+=8){
    const j=x+((y/8)%2)*4;s.rect(j+1,y+1,4,3,'344c4549');s.rect(j+2,y+4,2,1,'344c4549')
    s.rect(j,y+1,1,1,'d5e1d5ca')
  }
  store(s,'punched')
}
Promise.all(jobs).catch(error=>{console.error(error);process.exitCode=1})
