export type Mode = 'cabin' | 'lot' | 'team' | 'vision'
export type Stop = 'car' | 'team' | 'vision'
export type Point = { x: number; z: number }

export const stops: Record<Stop, Point> = {
  car: { x: -2.2, z: 4 }, team: { x: -9, z: 8.5 }, vision: { x: 8.5, z: 0 },
}
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
const obstacles = [
  [-1.85, 1.85, .75, 7.4], // truck
  [-11.5, -6.5, 4.1, 7.95], // booth
  [7.25, 9.75, -2.65, -.6], // ticket machine
]
export function walkable(x: number, z: number) {
  return x >= -13 && x <= 13 && z >= -9 && z <= 12 &&
    !obstacles.some(([left, right, near, far]) => x >= left && x <= right && z >= near && z <= far)
}
export function nearby(point: Point): Stop | null {
  return (Object.keys(stops) as Stop[]).find(id => distance(stops[id], point) < 2.1) ?? null
}

// Half-metre grid. A four-way path keeps auto-walking clear of building corners.
export function walkPath(start: Point, end: Point): Point[] {
  if (!walkable(end.x, end.z)) return []
  const snap = (n: number) => Math.round(n * 2) / 2
  const key = (p: Point) => p.x + ',' + p.z
  const cells = (p: Point) => {
    const x = snap(p.x), z = snap(p.z)
    return [[x,z],[x+.5,z],[x-.5,z],[x,z+.5],[x,z-.5]]
      .map(([x,z]) => ({x,z})).filter(q => walkable(q.x,q.z)).sort((a,b) => distance(a,p)-distance(b,p))
  }
  const first = cells(start)[0], last = cells(end)[0]
  if (!first || !last) return []
  const queue = [first], parent = new Map<string, Point | null>([[key(first), null]])
  for (let head = 0; head < queue.length; head++) {
    const p = queue[head]
    if (p.x === last.x && p.z === last.z) {
      const route = [end]
      let q: Point | null = p
      while (q) { route.push(q); q = parent.get(key(q)) ?? null }
      return route.reverse()
    }
    for (const [dx,dz] of [[0,-.5],[.5,0],[0,.5],[-.5,0]]) {
      const q = { x:p.x+dx, z:p.z+dz }
      if (walkable(q.x,q.z) && !parent.has(key(q))) { parent.set(key(q),p); queue.push(q) }
    }
  }
  return []
}
