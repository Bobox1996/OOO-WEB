const http = require('node:http')
const path = require('node:path')
const { spawn } = require('node:child_process')

const street = process.argv.includes('--sumiyoshi')
const title = street ? 'OOO Sumiyoshi Pixelscape' : 'OOO Drive-In'
const host = '127.0.0.1'
const port = street ? 3021 : 3017
const url = `http://${host}:${port}`
const healthPath = '/__ooo_local_preview'
const signature = title + ' local preview'

function openPreview() {
  console.log(`Open ${url} in your browser.`)
  if (process.platform !== 'win32') return
  const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
    detached: true, stdio: 'ignore', windowsHide: true,
  })
  browser.on('error', () => console.log('Paste the address above into your browser.'))
  browser.unref()
}

async function main() {
  const root = path.resolve(__dirname, '..')
  process.chdir(root)
  let handleRequest
  const server = http.createServer(async (request, response) => {
    if (request.url === healthPath) {
      response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' })
      response.end(signature)
      return
    }
    try {
      await handleRequest(request, response)
    } catch (error) {
      console.error(error)
      if (!response.headersSent) response.writeHead(500)
      response.end('Unable to render the preview. See the preview console.')
    }
  })

  // Bind before preparing Next so concurrent double-clicks share one server.
  let ready, failed
  const prepared = new Promise((resolve, reject) => { ready = resolve; failed = reject })
  prepared.catch(() => {})
  handleRequest = async (request, response) => (await prepared)(request, response)
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, resolve)
    })
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error
    const existing = await fetch(url + healthPath, { signal: AbortSignal.timeout(4000) }).catch(() => null)
    if (existing?.ok && await existing.text() === signature) {
      openPreview()
      return
    }
    throw new Error(`Another service already uses ${url}. Close it and reopen this preview.`)
  }

  try {
    process.env.OOO_CINEMA_PREVIEW = '1'
    const app = require('next')({ dev: true, webpack: true, hostname: host, port, dir: root })
    await app.prepare()
    const handle = app.getRequestHandler()
    ready(handle)
    console.log(title + ' is ready. Keep this window open during the preview.')
    openPreview()
  } catch (error) {
    failed(error)
    server.close()
    throw error
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
