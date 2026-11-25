// Package the current React/Three.js game for local viewing without a web server.
const fs = require('node:fs')
const path = require('node:path')
const { webpack, LimitChunkCountPlugin } = require('next/dist/compiled/webpack/webpack')

const root = path.resolve(__dirname, '..')
const street = process.argv[2] === '--sumiyoshi'
const scene = street ? 'sumiyoshi' : 'drive-in'
const component = street ? 'Sumiyoshi' : 'DriveIn'
const title = street ? 'OOO Sumiyoshi Pixelscape' : 'OOO Drive-In Cinema'
const temp = path.join(root, '.next', 'ooo-portable', scene)
const defaultFile = street ? '../OOO-Sumiyoshi-Pixelscape.html' : '../OOO-Drive-In.html'
const destination = path.resolve(process.argv[street ? 3 : 2] || path.join(root, defaultFile))
const styles = fs.readFileSync(path.join(root, 'src/components', scene, scene + '.module.css'), 'utf8')
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/drive-in-snapshot.json'), 'utf8'))
if (street) {
  snapshot.projectDetails = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/sumiyoshi-project-snapshot.json'), 'utf8'))
}
const publicRoot = path.join(root, 'public')

fs.mkdirSync(temp, { recursive: true })
const writeModule = (name, contents) => {
  const file = path.join(temp, name)
  fs.writeFileSync(file, contents)
  return file
}

const typescript = writeModule('typescript.cjs', `
  const ts = require('typescript')
  module.exports = function (text) {
    return ts.transpileModule(text, { fileName: this.resourcePath, compilerOptions: {
      target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
    }}).outputText
  }`)
const cssClasses = writeModule('css.cjs', `
  module.exports = function (css) {
    const names = Array.from(css.matchAll(/\\.([a-zA-Z_][\\w-]*)/g), match => match[1])
    return 'export default ' + JSON.stringify(Object.fromEntries(names.map(name => [name, name])))
  }`)
const imageShim = writeModule('image.tsx', `
  export function getImageProps(props) { return {props} }
  export default function Image({src, fill, unoptimized, priority, quality, style, ...rest}) {
    return <img {...rest} src={typeof src === 'string' ? src : src.src}
      style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style}/>
  }`)
const linkShim = writeModule('link.tsx', `
  export default function Link({href, children, prefetch, ...props}) {
    return <a target="_blank" rel="noopener noreferrer" {...props}
      href={new URL(href, 'https://ooo-web.vercel.app/').href}>{children}</a>
  }`)
const entry = writeModule('entry.tsx', `
  import {createRoot} from 'react-dom/client'
  import {DefaultLoadingManager} from 'three'
  import Game from '@/components/${scene}/${component}'

  const packed = document.getElementById('cinema-assets')
  const {assets, snapshot} = JSON.parse(packed.textContent)
  packed.textContent = ''
  packed.remove()
  const urls = new Map()
  function packedURL(url) {
    if (urls.has(url)) return urls.get(url)
    if (!assets[url]) return url
    const [type, base64] = assets[url]
    const bytes = Uint8Array.fromBase64 ? Uint8Array.fromBase64(base64) :
      Uint8Array.from(atob(base64), char => char.charCodeAt(0))
    const objectURL = URL.createObjectURL(new Blob([bytes], {type}))
    urls.set(url, objectURL)
    delete assets[url]
    return objectURL
  }
  DefaultLoadingManager.setURLModifier(packedURL)
  for (const film of snapshot.projects) {
    if (film.cover) film.cover.url = packedURL(film.cover.url)
  }
  for (const project of Object.values(snapshot.projectDetails || {})) {
    // Photo essays contain many images. Only decode the ones the reader opens.
    for (const image of project.images) {
      const source = image.url
      Object.defineProperty(image, 'url', { enumerable: true, get: () => packedURL(source) })
    }
  }
  for (const member of snapshot.members) {
    if (member.portrait_url) member.portrait_url = packedURL(member.portrait_url)
  }
  createRoot(document.getElementById('cinema')).render(<Game {...snapshot} unavailable={false}/>)
`)

function packAssets() {
  const urls = new Map()
  const modelDir = '/' + scene + '/models/'
  const models = fs.readdirSync(path.join(publicRoot, modelDir)).filter(name => name.endsWith('.glb'))
  if (street) {
    for (const required of ['house','street','cafe-front','cafe','people','cola']) {
      if (!models.includes(required + '.glb')) throw new Error('Missing model: ' + modelDir + required + '.glb')
    }
  }
  for (const name of models) {
    urls.set(modelDir + name, 'model/gltf-binary')
  }
  for (const film of snapshot.projects) {
    if (film.cover) urls.set(film.cover.url, 'image/webp')
  }
  for (const project of Object.values(snapshot.projectDetails || {})) {
    for (const image of project.images) urls.set(image.url, 'image/webp')
  }
  for (const member of snapshot.members) {
    if (member.portrait_url) urls.set(member.portrait_url, 'image/webp')
  }
  const assets = {}
  for (const [url, type] of urls) {
    if (!url.startsWith(modelDir) && !url.startsWith('/drive-in/content/') && !(street && url.startsWith('/sumiyoshi/projects/'))) {
      throw new Error('Missing local snapshot media: ' + url)
    }
    assets[url] = [type, fs.readFileSync(path.join(publicRoot, url)).toString('base64')]
  }
  return assets
}

function inlineGame() {
  const js = fs.readFileSync(path.join(temp, 'cinema.js'), 'utf8')
  const css = styles.replace(/:global\(([^)]+)\)/g, '$1')
  const data = JSON.stringify({ assets: packAssets(), snapshot }).replaceAll('<', '\\u003c')
  const logo = fs.readFileSync(path.join(publicRoot, 'brand/out-of-office-tab-dark.png')).toString('base64')
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <meta name="color-scheme" content="${street ? 'light' : 'dark'}"><title>${title} · Local Preview</title>
    <link rel="icon" href="data:image/png;base64,${logo}">
    <style>*{box-sizing:border-box}html,body,#cinema{margin:0;width:100%;height:100%}
    body{--studio-font:Arial,Helvetica,sans-serif;background:#1e3040}p,h1,h2,h3,dl,dd{margin:0}
    button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
    a{color:inherit;text-decoration:none}img{display:block} ${css}</style></head>
    <body><div id="cinema"></div><script type="application/json" id="cinema-assets">${data}</script>
    <script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`
  fs.mkdirSync(path.dirname(destination), {recursive:true})
  fs.writeFileSync(destination + '.partial', html)
  fs.renameSync(destination + '.partial', destination)
  console.log(destination + ' (' + (Buffer.byteLength(html)/1024/1024).toFixed(1) + ' MB)')
}

const compiler = webpack({
  mode: 'production', context: root, target: 'web', entry,
  devtool: false, performance: { hints: false },
  output: {path: temp, filename:'cinema.js', publicPath:''},
  resolve: {extensions:['.ts','.tsx','.js','.mjs','.json'], alias:{
    '@':path.join(root,'src'), 'next/link$':linkShim, 'next/image$':imageShim,
  }},
  module: { rules:[
    {test:/\.tsx?$/, use:typescript}, {test:/\.css$/, use:cssClasses}, {test:/\.png$/,type:'asset/inline'},
  ]},
  optimization: { minimize: false, splitChunks:false },
  plugins: [new LimitChunkCountPlugin({maxChunks:1})],
})
compiler.run((error, stats) => {
  compiler.close(() => {
    if (error || stats.hasErrors()) {
      console.error(error || stats.toString({all:false,errors:true,errorDetails:true}))
      process.exitCode=1
    } else inlineGame()
  })
})
