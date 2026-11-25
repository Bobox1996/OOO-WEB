// Build a nearest-sampled RGBA atlas from the editable character sheets.
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const folder = __dirname
const cell = 256

async function readSheet(file) {
  const {data, info} = await sharp(path.join(folder, file)).removeAlpha().raw().toBuffer({resolveWithObject: true})
  const rgba = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i*3], g = data[i*3+1], b = data[i*3+2]
    // Remove the chroma plate and its antialiased fringe; preserve the cool jacket and olive fabric.
    if (g > 80 && g > Math.max(r,b)*1.38 + 13) continue
    rgba.set([r, Math.min(g, Math.max(r,b)+15), b, 255], i*4)
  }
  return {rgba, w:info.width, h:info.height}
}

async function main() {
  const frames = [], layers = [], portraits = []
  for (const [sheetIndex, file] of ['cast-sheet.png','player-sheet.png','rain-sheet.png'].entries()) {
    const {rgba,w,h} = await readSheet(file)
    for (let i = 0; i < 8; i++) {
      const col=i%4,row=Math.floor(i/4)
      let left=w,right=-1,top=h,bottom=-1
      for(let y=Math.round(row*h/2);y<Math.round((row+1)*h/2);y++)
        for(let x=Math.round(col*w/4);x<Math.round((col+1)*w/4);x++)
          if(rgba[(y*w+x)*4+3]){left=Math.min(x,left);right=Math.max(x,right);top=Math.min(y,top);bottom=Math.max(y,bottom)}
      if(right<left)throw new Error('Empty cell '+file+' '+i)
      const rect={left,top,width:right-left+1,height:bottom-top+1}
      if(!sheetIndex && i>0){
        // Zoom into the original ink artwork before reducing the world sprites.
        const size=Math.round(rect.height*.345)
        const head={left:Math.max(0,Math.round((left+right-size)/2)),top:Math.max(0,top-5),width:size,height:size}
        const portrait=await sharp(rgba,{raw:{width:w,height:h,channels:4}}).extract(head)
          .resize(96,96,{kernel:'nearest'}).png().toBuffer()
        portraits.push({input:portrait,left:(i-1)*96,top:0})
      }
      const {data,info}=await sharp(rgba,{raw:{width:w,height:h,channels:4}}).extract(rect)
        .resize({width:246,height:246,fit:'inside',kernel:'nearest'}).png().toBuffer({resolveWithObject:true})
      const x=cell*col+Math.floor((cell-info.width)/2), y=cell*(sheetIndex*2+row)+cell-4-info.height
      layers.push({input:data,left:x,top:y})
      frames.push({x,y,w:info.width,h:info.height})
    }
  }
  await sharp({create:{width:1024,height:1536,channels:4,background:'#00000000'}}).composite(layers)
    .png({palette:true,colours:192,dither:0}).toFile(path.join(folder,'residents.png'))
  fs.writeFileSync(path.join(folder,'sprite-frames.json'),JSON.stringify(frames,null,2)+'\n')
  await sharp({create:{width:7*96,height:96,channels:4,background:'#34474c'}}).composite(portraits)
    .png({palette:true,colours:160,dither:0}).toFile(path.join(folder,'dialogue.png'))
}
main().catch(error=>{console.error(error);process.exitCode=1})
