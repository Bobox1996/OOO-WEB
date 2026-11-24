export type Point = { x: number; z: number }
export type Rect = readonly [left: number, right: number, back: number, front: number]
type Obstacle = { rect: Rect } | { center: Point; radius: number }

export const memberStops = [
  'member-0', 'member-1', 'member-2', 'member-3', 'member-4', 'member-5', 'member-6',
] as const
export type MemberStop = (typeof memberStops)[number]
type Door = 'home-door' | 'home-entry' | 'cafe-entry' | 'cafe-door'
export type Stop = Door | MemberStop | 'sofa' | 'vision'
export type Area = 'home' | 'street' | 'cafe'
export type Action =
  | { kind: 'door'; arrival: Door }
  | { kind: 'sofa' }
  | { kind: 'vision' }
  | { kind: 'member'; index: number }

export type Station = {
  id: Stop
  area: Area
  point: Point
  approach: Point
  spawn: Point
  hitbox: Rect
  action: Action
}

const p = (x: number, z: number): Point => ({ x, z })
const box = (left: number, right: number, back: number, front: number): Obstacle =>
  ({ rect: [left, right, back, front] })
const circle = (x: number, z: number, radius: number): Obstacle => ({ center: p(x, z), radius })
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)

export const homeSpawn = p(2.04, 1.15)
export const cafeSpawn = p(0, 3.9)

export const npcPositions = [
  p(-4.30, -2.96), p(-1.10, -3.00), p(-3.24, -0.43), p(3.42, -2.74),
  p(3.52, 0.35), p(-3.79, 2.48), p(1.68, 1.63),
]
const memberApproaches = [
  p(-4.30, -0.64), p(-0.43, -2.25), p(-2.74, 0.45), p(2.39, -2.47),
  p(2.49, 0.54), p(-2.86, 2.73), p(0.77, 2.07),
]

function station(
  id: Stop, area: Area, point: Point, approach: Point, hitbox: Rect, action: Action, spawn = approach,
): Station {
  return { id, area, point, approach, hitbox, action, spawn }
}

export const members = memberStops.map((id, index) => {
  const center = npcPositions[index]
  return station(id, 'cafe', center, memberApproaches[index],
    [center.x - 0.48, center.x + 0.48, center.z - 0.48, center.z + 0.48], { kind: 'member', index })
})

const stations = [
  station('sofa', 'home', p(0, 1.2), homeSpawn, [-1.6, 1.6, 0.63, 1.83], { kind: 'sofa' }),
  station('home-door', 'home', p(3.9, 3.75), p(3.9, 3.65), [3.12, 4.68, 3.35, 4.2],
    { kind: 'door', arrival: 'home-entry' }, p(3.9, 3.05)),
  station('home-entry', 'street', p(0, 0.08), p(0, 1.2), [-0.84, 0.84, -0.15, 0.66],
    { kind: 'door', arrival: 'home-door' }, p(0, 1.6)),
  station('cafe-entry', 'street', p(-11.8, 0.08), p(-11.8, 1.2), [-12.67, -10.93, -0.15, 0.68],
    { kind: 'door', arrival: 'cafe-door' }, p(-11.8, 1.6)),
  station('vision', 'street', p(8.1, 0.3), p(8.1, 1.4), [7.36, 8.84, -0.22, 0.65], { kind: 'vision' }),
  station('cafe-door', 'cafe', p(0, 4.58), p(0, 4.3), [-0.87, 0.87, 4.1, 4.9],
    { kind: 'door', arrival: 'cafe-entry' }, cafeSpawn),
  ...members,
]
export const stops = Object.fromEntries(stations.map(stop => [stop.id, stop])) as Record<Stop, Station>

type AreaLayout = { bounds: Rect; obstacles: Obstacle[]; stops: Stop[] }

function layout(id: Area, bounds: Rect, obstacles: Obstacle[]): AreaLayout {
  return { bounds, obstacles, stops: stations.filter(stop => stop.area === id).map(stop => stop.id) }
}

// Rectangles and disks describe the actual furniture footprints; navigation expands them for the walker.
export const areas: Record<Area, AreaLayout> = {
  home: layout('home', [-5.2, 5.2, -4.2, 4.2], [
    box(-1.6, 1.6, 0.63, 1.83), box(-1.72, 1.72, -2.64, -2.36), box(-4.76, 4.76, -3.83, -2.88),
  ]),
  street: layout('street', [-23, 23, 0.75, 5.6], [
    box(7.47, 8.73, -0.22, 0.53),
  ]),
  cafe: layout('cafe', [-6.6, 6.6, -4.8, 4.8], [
    box(-5.80, -1.43, -2.20, -1.15), box(-6.0, 1.4, -4.64, -3.99),
    box(5.53, 6.35, -3.70, 1.23), circle(4.48, -2.75, 0.58), circle(4.62, 0.30, 0.58),
    circle(-4.87, 2.46, 0.58), circle(5.85, 3.32, 0.43), ...npcPositions.map(n => circle(n.x, n.z, 0.23)),
  ]),
}

function contains(rect: Rect, point: Point) {
  return point.x >= rect[0] && point.x <= rect[1] && point.z >= rect[2] && point.z <= rect[3]
}

export function pickStop(area: Area, point: Point): Stop | null {
  return areas[area].stops.find(id => contains(stops[id].hitbox, point)) ?? null
}

// A two-axis slab test also detects collisions with large movements between frames.
function crossesRect(from: Point, to: Point, rect: Rect, padding: number) {
  let enter = 0, leave = 1
  for (const [origin, delta, low, high] of [
    [from.x, to.x - from.x, rect[0] - padding, rect[1] + padding],
    [from.z, to.z - from.z, rect[2] - padding, rect[3] + padding],
  ]) {
    if (delta === 0) {
      if (origin < low || origin > high) return false
    } else {
      const a = (low - origin) / delta, b = (high - origin) / delta
      enter = Math.max(enter, Math.min(a, b))
      leave = Math.min(leave, Math.max(a, b))
      if (enter > leave) return false
    }
  }
  return true
}

function crosses(from: Point, to: Point, obstacle: Obstacle, radius: number) {
  if ('rect' in obstacle) return crossesRect(from, to, obstacle.rect, radius)
  const dx = to.x - from.x, dz = to.z - from.z
  const length2 = dx * dx + dz * dz
  const dot = (obstacle.center.x - from.x) * dx + (obstacle.center.z - from.z) * dz
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, dot / length2))
  return Math.hypot(from.x + dx * t - obstacle.center.x, from.z + dz * t - obstacle.center.z) <= obstacle.radius + radius
}

const playerRadius = 0.27

function clear(area: Area, from: Point, to: Point) {
  const { bounds, obstacles } = areas[area]
  return contains(bounds, to) && !obstacles.some(obstacle => crosses(from, to, obstacle, playerRadius))
}

export function walkable(area: Area, point: Point) {
  return clear(area, point, point)
}

export function nearby(area: Area, point: Point): Stop | null {
  let best: Stop | null = null, bestDistance = Infinity
  for (const id of areas[area].stops) {
    const target = stops[id]
    let gap = distance(point, target.approach)
    if (target.action.kind === 'sofa') {
      const [left, right, back, front] = target.hitbox
      const edge = p(Math.max(left, Math.min(right, point.x)), Math.max(back, Math.min(front, point.z)))
      gap = Math.min(gap, distance(point, edge))
    }
    if (target.action.kind === 'member') {
      // Approach from any side of an NPC unless a table, pilaster or counter separates you.
      const person = target.point
      const clearSight = !areas[area].obstacles.some(obstacle =>
        !('center' in obstacle && obstacle.center.x === person.x && obstacle.center.z === person.z)
        && crosses(point, person, obstacle, 0))
      if (clearSight) gap = Math.min(gap, distance(point, person) - 0.23)
    }
    if (gap < 1.1 && gap < bestDistance) {
      best = id
      bestDistance = gap
    }
  }
  return best
}

export function slideMove(area: Area, start: Point, dx: number, dz: number): Point {
  const end = p(start.x + dx, start.z + dz)
  if (clear(area, start, end)) return end
  const sideways = p(end.x, start.z)
  const first = clear(area, start, sideways) ? sideways : start
  const along = p(first.x, end.z)
  return clear(area, first, along) ? along : first
}

const grid = 0.5
const key = ({ x, z }: Point) => x + ',' + z
const offsets = [[0, -grid], [grid, 0], [0, grid], [-grid, 0]]

function entrances(area: Area, point: Point) {
  const baseX = Math.round(point.x / grid) * grid, baseZ = Math.round(point.z / grid) * grid
  const cells: Point[] = []
  for (const dx of [-grid, 0, grid]) for (const dz of [-grid, 0, grid]) {
    const cell = p(baseX + dx, baseZ + dz)
    if (clear(area, point, cell)) cells.push(cell)
  }
  return cells.sort((a, b) => distance(point, a) - distance(point, b))
}

function shorten(area: Area, from: Point, path: Point[]) {
  const corners: Point[] = []
  for (let i = 0; i < path.length; i++) {
    if (i + 1 < path.length && clear(area, from, path[i + 1])) continue
    from = path[i]
    corners.push(from)
  }
  return corners
}

export function walkPath(area: Area, start: Point, end: Point): Point[] {
  if (!walkable(area, start) || !walkable(area, end)) return []
  if (clear(area, start, end)) return [end]

  const queue = entrances(area, start)
  const parents = new Map<string, Point | null>(queue.map(cell => [key(cell), null]))
  const goals = new Set(entrances(area, end).map(key))
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]
    if (goals.has(key(cell))) {
      const path = [end]
      let previous: Point | null = cell
      while (previous) {
        path.push(previous)
        previous = parents.get(key(previous)) ?? null
      }
      return shorten(area, start, path.reverse())
    }
    for (const [dx, dz] of offsets) {
      const next = p(cell.x + dx, cell.z + dz), id = key(next)
      if (parents.has(id) || !clear(area, cell, next)) continue
      queue.push(next)
      parents.set(id, cell)
    }
  }
  return []
}
