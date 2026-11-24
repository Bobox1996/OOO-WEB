// Render transparent botanical studies used by the fine canopy planes.
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const out = process.argv[2]
let seed = 7196
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const elements = []
const palettes = [
  ['#385639', '#597340', '#82974c', '#adbb68'],
  ['#2d4837', '#416044', '#648155', '#89995b'],
  ['#2d4737', '#42684c', '#668356', '#8f9f5f'],
  ['#28392c', '#395039', '#526740', '#697849']
]
const f = n => n.toFixed(2)
const line = (x,y,u,v,w,c) => elements.push('<path d="M'+f(x)+' '+f(y)+' L'+f(u)+' '+f(v)+'" fill="none" stroke="'+c+'" stroke-linecap="round" stroke-width="'+f(w)+'"/>')
const polar=(x,y,a,r) => [x+Math.cos(a)*r,y+Math.sin(a)*r]
function leaf(i,x,y,l,angle) {
  const p=palettes[i],w=l*(.22+.14*rand()),cl=p[Math.floor(3*rand())],shade=p[1+Math.floor(3*rand())]
  elements.push('<g transform="translate('+f(x)+' '+f(y)+') rotate('+f(angle*180/Math.PI)+')">')
  if(i===0) {
    const pts=[[0,0],[.06,.37],[.18,.30],[.18,.55],[.34,.23],[.60,.32],[.73,.49],[.55,.13],[1,0],[.54,-.11],[.73,-.46],[.46,-.30],[.30,-.19],[.16,-.53],[.16,-.28],[.03,-.33]]
    elements.push('<path d="M'+pts.map(p=>f(l*p[0])+' '+f(l*p[1])).join(' L')+' Z" fill="'+cl+'"/>')
    for(const s of [-1,1]) {
      line(0,0,.63*l,.36*l*s,.57,shade)
      line(0,0,.18*l,.41*l*s,.48,shade)
    }
  } else {
    elements.push('<path d="M0 0 Q'+f(l*.40)+' '+f(-w*1.43)+' '+f(l)+' 0 Q'+f(l*.36)+' '+f(w*1.31)+' 0 0Z" fill="'+cl+'"/>')
    elements.push('<path d="M0 0 Q'+f(l*.40)+' '+f(-w*1.43)+' '+f(l)+' 0 Q'+f(l*.36)+' '+f(-w*.16)+' 0 0Z" fill="'+shade+'" opacity=".77"/>')
    for(let n=1;n<4;n++)line(l*(n/5),0,l*(n/5+.14),w*.61,.38,shade)
  }
  line(0,0,.86*l,0,.6,shade)
  elements.push('</g>')
}
function twig(i,x,y,a,len,level) {
  const [u,v]=polar(x,y,a,len)
  line(x,y,u,v,level===2?3.1:level===1?1.8:1.0,level===2?'#615f45':'#717447')
  if(level) {
    for(let j=0;j<5;j++) {
      const t=(j+1)/5
      const angle=a+(j%2===0?1:-1)*(.32+.62*rand())
      twig(i,x+(u-x)*t,y+(v-y)*t,angle,len*(.38+.22*rand()),level-1)
    }
  } else {
    for(let j=0;j<6;j++){
      const t=(j+1)/6
      const xx=x+(u-x)*t, yy=y+(v-y)*t
      if(i===2) {
        for(let n=0;n<18;n++) {
          const an=a+(rand()-.5)*3.45
          const [nx,ny]=polar(xx,yy,an,7+rand()*16)
          line(xx,yy,nx,ny,.75+rand()*.4,palettes[i][Math.floor(rand()*4)])
        }
      } else leaf(i,xx,yy,len*(.27+rand()*.22),a+(j%2===0?1:-1)*(.48+.85*rand()))
    }
  }
}
for(let i=0;i<4;i++){
  elements.push('<g transform="translate('+(i%2)*512+' '+Math.floor(i/2)*512+')"><svg width="512" height="512" viewBox="0 0 512 512">')
  for(let j=0;j<3;j++)twig(i,185+42*j,474,-Math.PI/2+(j-1)*.46+(rand()-.5)*.2,174+rand()*42,2)
  elements.push('</svg></g>')
}
const svg='<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">'+elements.join('')+'</svg>'
fs.mkdirSync(path.dirname(out),{recursive:true})
sharp(Buffer.from(svg)).png().toFile(out).catch(err=>{console.error(err);process.exitCode=1})
