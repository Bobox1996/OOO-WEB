// Extract keyed full-resolution paint studies, retaining thin stems through shared
// silhouettes. Texture sizing reflects the seated and walking cameras in the court.
const path = require('node:path')
const sharp = require('sharp')

const subjects = {
  tree: [
    ['black-pine', 430], ['rain-maple', 432],
    ['blue-oak', 310], ['camellia-branches', 325],
  ],
  herb: [
    ['fern-bank', 320], ['peace-lily', 346],
    ['ribbed-hosta', 310], ['woodland-grass', 318],
  ],
  suspension: [['trailing-philodendron', 336]],
}

async function preparePlate(sheet) {
  const source = path.join(__dirname, 'studies', sheet + '-study.png')
  const { data, info: { width, height } } = await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true})
  // Identify whole plants before cutting the individual plates. An overhanging
  // bough, for instance, may grow past the middle of the original canvas.
  const sample = 3, cols = Math.ceil(width / sample), rows = Math.ceil(height / sample)
  const filled = new Uint8Array(cols * rows), tags = new Int32Array(cols * rows)
  const mask = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const pos = y * width + x, i = pos * 3
    const r = data[i], g = data[i+1], b = data[i+2]
    if (Math.min(r,b) > g * 1.26 + 12 && Math.min(r,b) > 69 && Math.max(r,b) / Math.min(r,b) < 1.85) continue
    mask[pos] = 255
    filled[Math.floor(y/sample)*cols + Math.floor(x/sample)] = 1
  }
  const queue = new Int32Array(filled.length), groups = []
  for (let first = 0; first < filled.length; first++) {
    if (!filled[first] || tags[first]) continue
    const id = groups.length + 1
    let head = 0, tail = 1, sumX = 0, sumY = 0
    tags[first] = id
    queue[0] = first
    while (head < tail) {
      const pos = queue[head++], x = pos % cols, y = Math.floor(pos / cols)
      sumX += x; sumY += y
      for (let row=Math.max(y-1,0); row<=Math.min(y+1,rows-1); row++) {
        for (let col=Math.max(x-1,0); col<=Math.min(x+1,cols-1); col++) {
          const next=row*cols+col
          if (!filled[next] || tags[next]) continue
          tags[next]=id
          queue[tail++]=next
        }
      }
    }
    const quadrant = (sumX/tail > cols/2 ? 1 : 0) + (sumY/tail > rows/2 ? 2 : 0)
    groups.push({part: subjects[sheet].length === 1 ? 0 : quadrant, size:tail})
  }
  for (const [part, [name, size]] of subjects[sheet].entries()) {
    const pixels = Buffer.alloc(width * height * 4)
    let x0=width, y0=height, x1=0, y1=0
    for (let y=0; y<height; y++) for (let x=0; x<width; x++) {
      const pos=y*width+x, tag=tags[Math.floor(y/sample)*cols+Math.floor(x/sample)]
      if (!mask[pos] || !tag || groups[tag-1].part!==part || groups[tag-1].size<2) continue
      const src=pos*3, out=pos*4
      let r=data[src], g=data[src+1], b=data[src+2]
      // Remove the coloured fringe from antialiasing against the key.
      if (r>g+8 && b>g+8) { r=Math.min(r,g+5); b=Math.min(b,g+13) }
      const light=(.24*r+.62*g+.14*b)/255
      const shadow=(1-light)**2
      pixels[out]   = Math.round(Math.min(255, r*.88 + 3 + 5*light))
      pixels[out+1] = Math.round(Math.min(255, g*.96 + 6 + 3*light))
      pixels[out+2] = Math.round(Math.min(255, b*.89 + 10*shadow + 5))
      pixels[out+3] = 255
      x0=Math.min(x,x0); x1=Math.max(x,x1); y0=Math.min(y,y0); y1=Math.max(y,y1)
    }
    if (x1<=x0 || y1<=y0) throw new Error('Missing botanical silhouette: '+name)
    const resized=await sharp(pixels,{raw:{width,height,channels:4}})
      .extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1})
      .resize(size,size,{fit:'inside',kernel:'mitchell'}).raw().toBuffer({resolveWithObject:true})
    for (let i=0;i<resized.data.length;i+=4) {
      resized.data[i+3]=resized.data[i+3] < 106 ? 0 : 255
    }
    await sharp(resized.data,{raw:resized.info}).extend({top:2,bottom:2,left:2,right:2,
      background:{r:0,g:0,b:0,alpha:0}}).png({palette:true,quality:98,colours:128,dither:.04})
      .toFile(path.join(__dirname,'paint',name+'.png'))
  }
}
async function prepareBotanicals() { await Promise.all(Object.keys(subjects).map(preparePlate)) }
module.exports = prepareBotanicals
if (require.main===module) prepareBotanicals().catch(error=>{console.error(error);process.exitCode=1})
