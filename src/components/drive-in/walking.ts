export type Area = 'lot' | 'shop'
export type Mode = Area | 'cabin' | 'team' | 'vision'
export type MemberStop = `member-${0 | 1 | 2 | 3 | 4 | 5 | 6}`
export type Stop = 'car' | 'team' | 'vision' | 'exit' | MemberStop
export type Point = { x: number; z: number }
type Rectangle = readonly [left: number, right: number, back: number, front: number]

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
export const shopSpawn: Point = { x: 0, z: 4.55 }

export const memberStops: readonly MemberStop[] = [
  'member-0', 'member-1', 'member-2', 'member-3', 'member-4', 'member-5', 'member-6',
]

// Mesh origins from the shop floor plan. The first two members staff the till and stockroom.
export const npcPositions: readonly Point[] = [
  { x: -4.55, z: -0.42 }, { x: -5.85, z: -3.65 }, { x: -2.45, z: -1.95 },
  { x: 2, z: 1.08 }, { x: 4.33, z: -3.42 }, { x: 2.14, z: 3.7 }, { x: -2.45, z: 2.9 },
]

// Each stop has its own usable standing position, including the customer side of the till.
export const stops: Record<Stop, Point> = {
  car: { x: -2.15, z: 4 }, team: { x: -10, z: 7.55 }, vision: { x: 8.5, z: 0 },
  exit: { x: 0, z: 5.15 },
  'member-0': { x: -4.55, z: 1.93 }, 'member-1': { x: -4.85, z: -3.87 },
  'member-2': { x: -1.43, z: -1.95 }, 'member-3': { x: 1.03, z: 1.13 },
  'member-4': { x: 3.35, z: -3.38 }, 'member-5': { x: 1.17, z: 3.68 },
  'member-6': { x: -1.57, z: 2.73 },
}

const bounds: Record<Area, Rectangle> = {
  lot: [-14, 14, -11, 13],
  shop: [-6.55, 6.55, -5.35, 5.35],
}
const outdoorProps: Rectangle[] = [
  [-1.15, 1.15, 1.6, 6.4], [-13.6, -6.4, 1.3, 6.7], [7.65, 9.35, -2.3, -1.04],
]
const shelves: Rectangle[] = [
  [-6.25, -2.65, 0.15, 1.4], [-5.45, -3.5, -3.1, -1.45],
  [2.55, 5.55, -1.55, 0.05], [3.2, 5.5, 2.4, 3.3], [-6.4, 6.4, -5.6, -4.65],
]

function padded([left, right, back, front]: Rectangle): Rectangle {
  const radius = 0.28
  return [left - radius, right + radius, back - radius, front + radius]
}

const blockers: Record<Area, Rectangle[]> = {
  lot: outdoorProps.map(padded),
  shop: [...shelves.map(padded), ...npcPositions.map(({ x, z }): Rectangle => [
    x - 0.45, x + 0.45, z - 0.45, z + 0.45,
  ])],
}

function inside(x: number, z: number, [left, right, back, front]: Rectangle) {
  return x >= left && x <= right && z >= back && z <= front
}

export function walkable(x: number, z: number, area: Area = 'lot') {
  return inside(x, z, bounds[area]) && !blockers[area].some(rect => inside(x, z, rect))
}

const lotStops: readonly Stop[] = ['car', 'team', 'vision']
const shopStops: readonly Stop[] = ['exit', ...memberStops]

export function nearby(point: Point, area: Area = 'lot'): Stop | null {
  let nearest: Stop | null = null
  let closest = Infinity
  for (const id of area === 'lot' ? lotStops : shopStops) {
    const member = memberStops.indexOf(id as MemberStop)
    const range = member >= 0 ? 1.45 : area === 'lot' ? 1.8 : 1.05
    let separation = distance(point, member < 0 ? stops[id] : npcPositions[member])
    if (member === 0) {
      // Across the counter the customer naturally stands farther from the clerk.
      separation = Math.min(separation, distance(point, stops[id]) + 0.38)
    }
    if (separation <= range && separation < closest) {
      nearest = id
      closest = separation
    }
  }
  return nearest
}

// Intersect the finite movement segment with each axis interval of a solid footprint.
function crosses(from: Point, to: Point, [left, right, back, front]: Rectangle) {
  let enter = 0
  let leave = 1
  for (const [origin, delta, min, max] of [
    [from.x, to.x - from.x, left, right], [from.z, to.z - from.z, back, front],
  ]) {
    if (delta === 0) {
      if (origin < min || origin > max) return false
    } else {
      const a = (min - origin) / delta
      const b = (max - origin) / delta
      enter = Math.max(enter, Math.min(a, b))
      leave = Math.min(leave, Math.max(a, b))
      if (enter > leave) return false
    }
  }
  return true
}

function clear(from: Point, to: Point, area: Area) {
  return inside(to.x, to.z, bounds[area]) && !blockers[area].some(rect => crosses(from, to, rect))
}

export function slideMove(start: Point, dx: number, dz: number, area: Area = 'lot'): Point {
  const target = { x: start.x + dx, z: start.z + dz }
  if (clear(start, target, area)) return target
  const sideways = { x: target.x, z: start.z }
  const first = clear(start, sideways, area) ? sideways : start
  const forward = { x: first.x, z: target.z }
  return clear(first, forward, area) ? forward : first
}

const step = 0.5
const key = ({ x, z }: Point) => x + ',' + z

function connections(point: Point, area: Area) {
  const x = Math.round(point.x / step) * step
  const z = Math.round(point.z / step) * step
  const cells: Point[] = []
  for (const dx of [-step, 0, step]) {
    for (const dz of [-step, 0, step]) {
      const cell = { x: x + dx, z: z + dz }
      if (clear(point, cell, area)) cells.push(cell)
    }
  }
  return cells.sort((a, b) => distance(a, point) - distance(b, point))
}

function smooth(start: Point, path: Point[], area: Area) {
  const result: Point[] = []
  let from = start
  for (let i = 0; i < path.length; i++) {
    if (i + 1 < path.length && clear(from, path[i + 1], area)) continue
    from = path[i]
    result.push(from)
  }
  return result
}

export function walkPath(start: Point, end: Point, area: Area = 'lot'): Point[] {
  if (!walkable(start.x, start.z, area) || !walkable(end.x, end.z, area)) return []
  if (clear(start, end, area)) return [end]

  const queue = connections(start, area)
  const parents = new Map<string, Point | null>(queue.map(cell => [key(cell), null]))
  const goal = new Set(connections(end, area).map(key))
  const neighbors = [[0, -step], [step, 0], [0, step], [-step, 0]]
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]
    if (goal.has(key(current))) {
      const path = [end]
      let cell: Point | null = current
      while (cell) {
        path.push(cell)
        cell = parents.get(key(cell)) ?? null
      }
      return smooth(start, path.reverse(), area)
    }
    for (const [dx, dz] of neighbors) {
      const next = { x: current.x + dx, z: current.z + dz }
      const id = key(next)
      if (parents.has(id) || !clear(current, next, area)) continue
      parents.set(id, current)
      queue.push(next)
    }
  }
  return []
}
