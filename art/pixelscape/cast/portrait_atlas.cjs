// Rebuild the nearest-filtered face sheet from the studio's published portraits.
// Each measurement is [left eye, right eye, chin], marked on the 230 × 260 proof.
// A three-point map preserves each person's expression and head tilt.
const path = require('node:path')
const sharp = require('sharp')
const here = __dirname
const root = path.resolve(here, '../../..')
const marks = [
  [[106,74],[132,76],[118,127]], [[95,90],[123,91],[109,146]],
  [[81,113],[114,105],[105,174]], [[72,90],[105,87],[88,159]],
  [[98,96],[131,92],[117,168]], [[98,149],[136,147],[117,222]],
  [[99,93],[128,91],[114,145]],
]
const ramps = [
  '#171c22','#2e3033','#484142','#60504e','#765f57','#897366',
  '#a28a77','#b8a08a','#cbb79d','#ddc7ac','#e6d3b9','#efdec6',
].map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)))
const size=64
async function main(){
  const pixels=Buffer.alloc(7*size*size*3)
  for (let i=0;i<7;i++){
    const source=path.join(root,'public/drive-in/content','member-'+String(i+1).padStart(2,'0')+'.webp')
    const {data,info} = await sharp(source).flatten({background:'#848484'}).median(3).removeAlpha().raw().toBuffer({resolveWithObject:true})
    const [l,r,c]=marks[i], middle=[(r[0]+l[0])/2,(r[1]+l[1])/2]
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      // The jaw is y=0, the canthi are at 118 mm, and crown is 232 mm.
      const xm=((x+.5)/size-.5)*.192,zm=(1-(y+.5)/size)*.240
      const u=xm/.062,v=zm/.118
      const sx=Math.round(((1-v)*c[0]+v*middle[0]+u*(r[0]-l[0]))*info.width/230)
      const sy=Math.round(((1-v)*c[1]+v*middle[1]+u*(r[1]-l[1]))*info.height/260)
      const off=(Math.min(info.height-1,Math.max(0,sy))*info.width+Math.min(info.width-1,Math.max(0,sx)))*info.channels
      const value=(data[off]*.22+data[off+1]*.71+data[off+2]*.07)/255
      // The middle two portraits were exposed for an almost black background.
      // Restore the facial midtones before a second layer of in-game lighting.
      const exposure=i===4||i===5?.14:.035
      const band=Math.min(ramps.length-1,Math.floor((exposure+(1-exposure)*Math.pow(value,.79))*ramps.length))
      const idx=(y*(size*7)+i*size+x)*3
      for(let k=0;k<3;k++)pixels[idx+k]=ramps[band][k]
    }
  }
  await sharp(pixels,{raw:{width:size*7,height:size,channels:3}}).png().toFile(path.join(here,'faces.png'))
}
main().catch(e=>{console.error(e);process.exitCode=1})
