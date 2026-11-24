// Albedo plates for the coastal listening room. Run with Node from any directory.
// All patterns repeat in UV space. The oak is four sequential veneer leaves across,
// with vertical grain; cloth, stone and plaster do not contain any baked room light.
const path = require('node:path')
const sharp = require('sharp')
const tau = 2 * Math.PI
const wrap = (n, repeat) => (n % repeat + repeat) % repeat
const fract = n => n - Math.floor(n)
const ease = t => t * t * (3 - 2 * t)
const blend = (a, b, t) => a + (b - a) * t
const clamp = t => Math.max(0, Math.min(1, t))

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

function tint(base, range, value, chalk = 0) {
  return base.map((channel, i) => channel + range[i] * value + chalk)
}

function oak(u, v) {
  const index = Math.min(3, Math.floor(u * 4))
  const leaf = fract(u * 4)
  // Two pairs of consecutive slices, opened like book pages; the fork of the
  // growth rings stays in phase across the join, while the pores vary by slice.
  const pair = Math.floor(index / 2), book = index % 2 ? 1 - leaf : leaf
  const s = 31 + 17 * pair
  const bend = .020 * grain(book, v, 3, 3, s) + .025 * Math.sin(tau * v + 1.3 * pair)
  const q = book + bend
  const centre = pair ? .69 : .29
  const cut = .15 + .06 * Math.sin(tau * v + pair) + .023 * Math.cos(tau * 2 * v - .7)
  const distance = pair ? Math.hypot(q - centre, cut) : q
  const annual = distance * (pair ? 16 : 14) + .50 * grain(q, v, 7, 2, s + 2)
  const early = Math.pow(.5 + .5 * Math.cos(tau * annual), 3.9)
  const bundles = grain(q + .005 * Math.sin(2 * tau * v), v, 46, 6, s + 3)
  const vessel = Math.max(0, grain(q + .12 * distance, v, 120, 25, s + index + 6) - .16)
  const ray = Math.max(0, grain(q + .04 * Math.sin(tau * v), v, 80, 112, s + index + 8) - .35)
  const glint = ray * (2 + 3 * clamp((bundles + 1) / 2))
  const band = .16 + .24 * clamp(.55 + grain(q, v, 4, 3, s + 12))
  const value = .54 * grain(q, v, 7, 1, s + 4) + .38 * bundles -
    band * (early - .26) - .44 * vessel + .08 * grain(leaf, v, 136, 67, s + 11)
  return tint([170, 122, 82], [24, 23, 21], value, glint + [1.3, -.5, -1.4, .8][index])
}

// Distance to the two nearest pebbles, with wraparound at the sample boundary.
function pebble(u, v, nx, ny, seed) {
  const x = u * nx, y = v * ny
  const ix = Math.floor(x), iy = Math.floor(y)
  let first = 4, second = 4
  for (let row = iy - 1; row <= iy + 1; row++) {
    for (let col = ix - 1; col <= ix + 1; col++) {
      const a = wrap(col, nx), b = wrap(row, ny)
      const dx = col + .15 + .70 * hash(a, b, seed) - x
      const dy = row + .15 + .70 * hash(a, b, seed + 5) - y
      const d = dx * dx + dy * dy
      if (d < first) { second = first; first = d } else if (d < second) second = d
    }
  }
  return { distance: Math.sqrt(first), edge: Math.sqrt(second) - Math.sqrt(first) }
}

function graphite(u, v) {
  const peb = pebble(u + .009 * grain(u, v, 9, 5, 84), v, 38, 47, 72)
  const crease = clamp(1 - peb.edge * 10)
  const pore = Math.max(0, grain(u, v, 103, 151, 202) - .65)
  const value = .53 * grain(u, v, 5, 5, 79) + .19 * grain(u, v, 33, 27, 63)
    - .57 * (crease - .22) - .68 * pore + .1 * Math.cos(peb.distance * 4)
  return tint([52, 52, 51], [9.2, 9.0, 8.8], value)
}

function boucle(u, v) {
  const row = Math.floor(v * 65)
  const s = u + .003 * grain(u, v, 32, 14, 77) + .42 * (row % 2) / 69
  const loop = pebble(s, v, 67, 57, 26)
  const centre = Math.exp(-22 * loop.distance * loop.distance)
  const yarn = .5 - Math.min(1, Math.abs(loop.distance - .31) * 4.4)
  const slub = grain(u, v, 83, 70, 18) * .33 + grain(s, v, 31, 20, 57) * .26
  return tint([185, 172, 151], [15, 15, 14], .72 * yarn - .36 * centre + slub + .13 * grain(u, v, 8, 8, 51))
}

function linen(u, v) {
  const warp = u * 59 + .18 * grain(u, v, 14, 5, 20)
  const weft = v * 64 + .17 * grain(u, v, 7, 21, 36)
  const forward = (Math.floor(warp) + Math.floor(weft)) % 2 === 0
  const yarn = Math.cos(tau * ((forward ? warp : weft) - .5))
  const slub = (forward ? grain(u, v, 87, 18, 52) : grain(u, v, 19, 82, 41))
  return tint([216, 205, 184], [8, 8.6, 9], .23 * yarn + .42 * slub + .36 * grain(u, v, 9, 7, 23))
}

function travertine(u, v) {
  const bed = v + .034 * grain(u, v, 4, 3, 451) + .006 * grain(u, v, 11, 7, 511)
  const sediment = grain(u, bed, 4, 18, 40) + .54 * grain(u, bed, 12, 52, 47)
  const pores = Math.max(0, grain(u, bed, 118, 119, 222) - .39)
  const calcite = Math.max(0, grain(u, bed, 29, 84, 253) - .40)
  return tint([195, 179, 155], [12, 13, 14], .57 * sediment + .28 * grain(u, v, 23, 17, 81) - pores + .76 * calcite)
}

function screed(u, v) {
  const mineral = grain(u, v, 109, 107, 912)
  const value = .48 * grain(u, v, 4, 5, 134) + .36 * grain(u, v, 13, 10, 47) +
    .19 * mineral + .39 * Math.max(0, mineral - .56)
  return tint([157, 152, 142], [8, 8, 8], value)
}

function plaster(u, v) {
  const trowel = grain(u + .045 * Math.sin(v * tau), v, 11, 9, 321)
  const value = .42 * grain(u, v, 5, 4, 556) + .30 * trowel + .2 * grain(u, v, 58, 61, 526)
  return tint([201, 188, 169], [6, 6, 6], value)
}

function sudare(u, v) {
  // Reed sheaths and pale binding thread form a continuous low-contrast field;
  // the shade transmits the ocean light through the material's uniform alpha.
  const row = v * 29 + .085 * grain(u, v, 6, 6, 118)
  const reed = .5 + .5 * Math.cos(tau * (row - .44))
  const binding = .5 + .5 * Math.cos(tau * (u * 14 + .04 * grain(u, v, 7, 5, 131)))
  const value = .34 * grain(u, v, 17, 33, 302) + .24 * grain(u, v, 4, 6, 67)
    + .31 * (reed - .5) + .17 * (binding * binding - .38)
  return tint([190, 182, 162], [9, 8, 7], value)
}

async function write(name, width, height, pigment) {
  const data = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const colour = pigment((x + .5) / width, (y + .5) / height)
      for (let i = 0; i < 3; i++) data[(y * width + x) * 3 + i] = Math.round(colour[i])
    }
  }
  const output = path.join(__dirname, name + '.png')
  await sharp(data, {raw: {width, height, channels: 3}})
    .png({palette: true, colours: 128, dither: 0, compressionLevel: 9}).toFile(output)
}

Promise.all([
  write('honey-oak', 1024, 512, oak),
  write('graphite-leather', 256, 256, graphite),
  write('oat-boucle', 256, 256, boucle),
  write('ivory-linen', 256, 256, linen),
  write('dune-travertine', 512, 256, travertine),
  write('smoke-screed', 384, 384, screed),
  write('ecru-plaster', 384, 384, plaster),
  write('mist-sudare', 128, 128, sudare),
]).catch(error => { console.error(error); process.exitCode = 1 })
