// Pixel albedo plates for the coastal listening room. Each tile is drawn at its
// native resolution. Repeated UVs keep grain, seams and mineral bands attached
// to the building as the player moves.
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS texture generator. */
const path = require('node:path')
const sharp = require('sharp')
const tau = 2 * Math.PI
const wrap = (n, repeat) => (n % repeat + repeat) % repeat
const fract = n => n - Math.floor(n)
const ease = t => t * t * (3 - 2 * t)
const blend = (a, b, t) => a + (b - a) * t

function hash(x, y, seed) {
  let v = Math.imul(x + seed, 374761393) + Math.imul(y, 668265263)
  v = Math.imul(v ^ (v >>> 13), 1274126177)
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296
}

function grain(u, v, nx, ny, seed) {
  const x = u * nx, y = v * ny
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const sx = ease(fract(x)), sy = ease(fract(y))
  const a = wrap(x0, nx), b = wrap(x0 + 1, nx)
  const c = wrap(y0, ny), d = wrap(y0 + 1, ny)
  return blend(blend(hash(a, c, seed), hash(b, c, seed), sx),
    blend(hash(a, d, seed), hash(b, d, seed), sx), sy) * 2 - 1
}

function palette(colours) {
  const inks = colours.split(' ').map(hex => Buffer.from(hex, 'hex'))
  return value => inks[Math.max(0, Math.min(inks.length - 1, Math.floor((value + 1) * .5 * inks.length)))]
}

const wood = palette('815843 916448 a3714e af7d54 bd8b60 cd9d71')
const hide = palette('292b30 32343a 37383d 404146')
const wool = palette('aa9b88 b4a58f beaf99 c7b9a4')
const flax = palette('c7baa6 d1c4ae d9cdb8 dfd5c0')
const stone = palette('a59585 b6a18b c4ae97 d0bda5 dcceb5')
const mineral = palette('898784 95908a 9f9b92 a7a299')
const chalk = palette('beb3a4 c4b9a9 cbbfaf d2c6b4')
const reed = palette('a39c8b b3ab98 beb5a1 cac0a9')

function oak(u, v) {
  // Four leaves across 3.87 metres. The pairs open around a mirrored cathedral
  // figure. Each annual ring resolves as a broken, stepped stroke between calmer
  // fields of heartwood, with a few long dark vessels running alongside it.
  const index = Math.floor(u * 4), leaf = fract(u * 4)
  const book = index % 2 ? 1 - leaf : leaf
  const pair = Math.floor(index / 2), seed = 31 + pair * 17
  const bend = .024 * grain(book, v, 4, 3, seed) + .027 * Math.sin(tau * v + pair)
  const q = book + bend
  const cut = .17 + .13 * Math.cos(tau * v + .6 * pair)
  const annual = Math.hypot(q - (pair ? .73 : .24), cut) * (pair ? 10 : 8)
    + .17 * grain(q, v, 5, 2, seed + 1)
  const ring = fract(annual)
  const field = .43 * grain(q, v, 6, 2, seed + 2) + .28 * grain(q, v, 17, 4, seed + 3)
  const edge = ring < .17 && grain(q, v, 9, 4, seed + 4) > -.28
  const sap = ring > .79 && grain(q, v, 7, 6, seed + 5) > .03
  const pores = grain(q, v, 43, 11, seed + index + 6) > .67
  return wood(field - (edge ? .43 : 0) + (sap ? .25 : 0) - (pores ? .29 : 0))
}

function graphite(u, v) {
  const body = grain(u, v, 3, 4, 79)
  const brokenCrease = Math.abs(grain(u + .035 * body, v, 7, 3, 80)) < .095
  const pebble = grain(u, v, 14, 13, 82)
  return hide(.40 * body + .21 * pebble - (brokenCrease && pebble < .32 ? .33 : 0))
}

function boucle(u, v) {
  const row = Math.floor(v * 8)
  const yarn = grain(u + (row % 2) / 16, v, 8, 8, 26)
  const tip = fract(v * 8) > .64 && fract(u * 8 + (row % 2) * .5) < .5
  return wool(.38 * yarn + .17 * grain(u, v, 3, 4, 57) + (tip ? .34 : -.13))
}

function linen(u, v) {
  const row = Math.floor(v * 8), col = Math.floor(u * 8)
  const warp = (col + row) % 2 === 0
  const yarn = warp ? grain(u, v, 8, 3, 20) : grain(u, v, 3, 8, 36)
  return flax(.42 * yarn + (fract((warp ? u : v) * 8) < .26 ? -.30 : .09))
}

function travertine(u, v) {
  const bed = v + .039 * grain(u, v, 3, 2, 451)
  const strata = grain(u, bed, 3, 15, 40)
  const freckle = grain(u, bed, 28, 25, 222)
  const pocket = Math.abs(strata + .14) < .12 && grain(u, v, 8, 9, 81) > .07
  return stone(.48 * strata + .24 * grain(u, v, 4, 3, 47)
    - (pocket ? .45 : 0) + (freckle > .67 ? .29 : 0))
}

function screed(u, v) {
  const aggregate = grain(u, v, 23, 19, 912)
  const field = .36 * grain(u, v, 4, 4, 134) + .19 * grain(u, v, 9, 7, 47)
  return mineral(field + (aggregate > .70 ? .30 : 0))
}

function plaster(u, v) {
  const trowel = grain(u + .035 * Math.sin(v * tau), v, 6, 9, 321)
  return chalk(.35 * grain(u, v, 4, 3, 556) + .30 * trowel)
}

function sudare(u, v) {
  const weft = fract(v * 8 + .07 * grain(u, v, 4, 3, 118))
  const binding = fract(u * 4) < .12 && weft > .3
  return reed(.31 * grain(u, v, 5, 7, 302) + (weft < .29 ? -.39 : .11) + (binding ? .29 : 0))
}

async function write(name, width, height, pigment) {
  const data = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ink = pigment((x + .5) / width, (y + .5) / height)
      ink.copy(data, (y * width + x) * 3)
    }
  }
  const output = path.join(__dirname, name + '.png')
  await sharp(data, {raw: {width, height, channels: 3}})
    .png({palette: true, colours: 8, dither: 0, compressionLevel: 9}).toFile(output)
}

Promise.all([
  write('honey-oak', 256, 160, oak),
  write('graphite-leather', 32, 32, graphite),
  write('oat-boucle', 32, 32, boucle),
  write('ivory-linen', 32, 32, linen),
  write('dune-travertine', 96, 48, travertine),
  write('smoke-screed', 96, 96, screed),
  write('ecru-plaster', 112, 112, plaster),
  write('mist-sudare', 32, 32, sudare),
]).catch(error => { console.error(error); process.exitCode = 1 })
