// ──────────────────────────────────────────────────────────────
// metaball.utils.ts
// Pure-function utilities for 2D metaball isocurve extraction
// using marching squares.
// ──────────────────────────────────────────────────────────────

export interface Point2D {
  x: number
  y: number
}

export interface PlaneTransform {
  origin: Point2D
  xAxis: Point2D
  yAxis: Point2D
}

/** Default identity plane (no transform). */
const IDENTITY_PLANE: PlaneTransform = {
  origin: { x: 0, y: 0 },
  xAxis: { x: 1, y: 0 },
  yAxis: { x: 0, y: 1 },
}

// ── Seeded PRNG (mulberry32) ────────────────────────────────

/**
 * Create a seeded pseudo-random number generator (mulberry32).
 * Returns a function that yields values in [0, 1) on each call.
 */
export function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 20), 10 | s)
    t = (t + Math.imul(t ^ (t >>> 10), 20 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Populate `totalPoints` points in a 100×100 bounding box using
 * stratified jittered sampling for even spatial distribution.
 * Charges are picked at evenly spaced indices so they are
 * scattered across the entire area rather than clustered together.
 */
export function generatePoints(
  totalPoints: number,
  chargeCount: number,
  seed: number,
): { charges: Point2D[]; passThroughPoints: Point2D[] } {
  const rng = seededRandom(seed)
  const cols = Math.ceil(Math.sqrt(totalPoints))
  const rows = Math.ceil(totalPoints / cols)
  const cellW = 20 / cols
  const cellH = 20 / rows
  const jitter = 0.7
  const pad = (1 - jitter) / 2

  const all: Point2D[] = []
  for (let r = 0; r < rows && all.length < totalPoints; r++) {
    for (let c = 0; c < cols && all.length < totalPoints; c++) {
      all.push({
        x: (c + pad + rng() * jitter) * cellW,
        y: (r + pad + rng() * jitter) * cellH,
      })
    }
  }

  // Pick charges at evenly spaced indices so they are spatially scattered
  const safeChargeCount = Math.min(chargeCount, totalPoints - 1)
  const stride = totalPoints / safeChargeCount
  const chargeIndices = new Set<number>()
  for (let i = 0; i < safeChargeCount; i++) {
    chargeIndices.add(Math.floor(i * stride))
  }

  const charges: Point2D[] = []
  const passThroughPoints: Point2D[] = []
  for (let i = 0; i < all.length; i++) {
    if (chargeIndices.has(i)) {
      charges.push(all[i])
    } else {
      passThroughPoints.push(all[i])
    }
  }

  return { charges, passThroughPoints }
}

// ── Scalar field ────────────────────────────────────────────

/**
 * Evaluate the metaball scalar field at a point.
 * f(p) = SUM( 1 / |p - Pi|^2 )
 */
export function computeField(p: Point2D, charges: Point2D[]): number {
  let sum = 0
  for (const c of charges) {
    const dx = p.x - c.x
    const dy = p.y - c.y
    const d2 = dx * dx + dy * dy
    if (d2 < 1e-10) return 1e10 // avoid division-by-zero singularity
    sum += 1 / d2
  }
  return sum
}

// ── Plane helpers ───────────────────────────────────────────

/** Map grid-local (u,v) → world (x,y) using plane transform */
function planeToWorld(
  u: number,
  v: number,
  plane: PlaneTransform,
): Point2D {
  return {
    x: plane.origin.x + u * plane.xAxis.x + v * plane.yAxis.x,
    y: plane.origin.y + u * plane.xAxis.y + v * plane.yAxis.y,
  }
}

// ── Marching squares ────────────────────────────────────────

/**
 * Linearly interpolate between two 1-D values to find
 * where the function crosses `threshold`.
 * Returns a parameter t in [0,1].
 */
function lerpT(v0: number, v1: number, threshold: number): number {
  const denom = v1 - v0
  if (Math.abs(denom) < 1e-12) return 0.5
  return (threshold - v0) / denom
}

// Edge indices within a cell:
//   0 = bottom (v0→v1), 1 = right (v1→v2), 2 = top (v3→v2), 3 = left (v0→v3)
//
// Corner layout:
//   v3 ── edge2 ── v2
//   |               |
//  edge3           edge1
//   |               |
//   v0 ── edge0 ── v1

// Segment table: for each of the 16 marching-squares cases,
// list of pairs of edges that form line segments in that cell.
const SEGMENT_TABLE: number[][][] = [
  [],                  // 0  (0000)
  [[3, 0]],            // 1  (0001)
  [[0, 1]],            // 2  (0010)
  [[3, 1]],            // 3  (0011)
  [[1, 2]],            // 4  (0100)
  [[3, 0], [1, 2]],    // 5  (0101) saddle
  [[0, 2]],            // 6  (0110)
  [[3, 2]],            // 7  (0111)
  [[2, 3]],            // 8  (1000)
  [[2, 0]],            // 9  (1001)
  [[0, 1], [2, 3]],    // 10 (1010) saddle
  [[2, 1]],            // 11 (1011)
  [[1, 3]],            // 12 (1100)
  [[1, 0]],            // 13 (1101)
  [[0, 3]],            // 14 (1110)
  [],                  // 15 (1111)
]

interface GridInfo {
  cols: number
  rows: number
  step: number
  minU: number
  minV: number
  /** field values indexed as [row][col] */
  values: number[][]
}

function sampleGrid(
  charges: Point2D[],
  plane: PlaneTransform,
  bounds: { minU: number; maxU: number; minV: number; maxV: number },
  step: number,
): GridInfo {
  const cols = Math.ceil((bounds.maxU - bounds.minU) / step) + 1
  const rows = Math.ceil((bounds.maxV - bounds.minV) / step) + 1
  const values: number[][] = []

  for (let r = 0; r < rows; r++) {
    const row: number[] = []
    for (let c = 0; c < cols; c++) {
      const u = bounds.minU + c * step
      const v = bounds.minV + r * step
      const world = planeToWorld(u, v, plane)
      row.push(computeField(world, charges))
    }
    values.push(row)
  }

  return { cols, rows, step, minU: bounds.minU, minV: bounds.minV, values }
}

/** Compute the crossing point on an edge given edge index and cell corner values. */
function edgePoint(
  edgeIdx: number,
  cellU: number,
  cellV: number,
  step: number,
  v0: number,
  v1: number,
  v2: number,
  v3: number,
  threshold: number,
): Point2D {
  switch (edgeIdx) {
    case 0: { // bottom: v0 → v1
      const t = lerpT(v0, v1, threshold)
      return { x: cellU + t * step, y: cellV }
    }
    case 1: { // right: v1 → v2
      const t = lerpT(v1, v2, threshold)
      return { x: cellU + step, y: cellV + t * step }
    }
    case 2: { // top: v3 → v2
      const t = lerpT(v3, v2, threshold)
      return { x: cellU + t * step, y: cellV + step }
    }
    case 3: { // left: v0 → v3
      const t = lerpT(v0, v3, threshold)
      return { x: cellU, y: cellV + t * step }
    }
    default:
      return { x: cellU, y: cellV }
  }
}

interface Segment {
  a: Point2D
  b: Point2D
}

/**
 * Run marching squares over the sampled grid and return an array of
 * line segments (in grid-local u,v coordinates).
 */
function extractSegments(grid: GridInfo, threshold: number): Segment[] {
  const segments: Segment[] = []

  for (let r = 0; r < grid.rows - 1; r++) {
    for (let c = 0; c < grid.cols - 1; c++) {
      const v0 = grid.values[r][c]
      const v1 = grid.values[r][c + 1]
      const v2 = grid.values[r + 1][c + 1]
      const v3 = grid.values[r + 1][c]

      // Build case index
      let caseIdx = 0
      if (v0 >= threshold) caseIdx |= 1
      if (v1 >= threshold) caseIdx |= 2
      if (v2 >= threshold) caseIdx |= 4
      if (v3 >= threshold) caseIdx |= 8

      const segs = SEGMENT_TABLE[caseIdx]
      if (!segs || segs.length === 0) continue

      const cellU = grid.minU + c * grid.step
      const cellV = grid.minV + r * grid.step

      for (const [e0, e1] of segs) {
        const a = edgePoint(e0, cellU, cellV, grid.step, v0, v1, v2, v3, threshold)
        const b = edgePoint(e1, cellU, cellV, grid.step, v0, v1, v2, v3, threshold)
        segments.push({ a, b })
      }
    }
  }

  return segments
}

// ── Path assembly ───────────────────────────────────────────

const EPS = 1e-6

function ptEq(a: Point2D, b: Point2D): boolean {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS
}

/**
 * Stitch unordered segments into polylines.
 */
function assemblePolylines(segments: Segment[]): Point2D[][] {
  if (segments.length === 0) return []

  const used = new Array<boolean>(segments.length).fill(false)
  const polylines: Point2D[][] = []

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue
    used[i] = true

    const chain: Point2D[] = [segments[i].a, segments[i].b]

    // Extend forward
    let changed = true
    while (changed) {
      changed = false
      const tail = chain[chain.length - 1]
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue
        if (ptEq(tail, segments[j].a)) {
          chain.push(segments[j].b)
          used[j] = true
          changed = true
        } else if (ptEq(tail, segments[j].b)) {
          chain.push(segments[j].a)
          used[j] = true
          changed = true
        }
      }
    }

    // Extend backward
    changed = true
    while (changed) {
      changed = false
      const head = chain[0]
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue
        if (ptEq(head, segments[j].b)) {
          chain.unshift(segments[j].a)
          used[j] = true
          changed = true
        } else if (ptEq(head, segments[j].a)) {
          chain.unshift(segments[j].b)
          used[j] = true
          changed = true
        }
      }
    }

    polylines.push(chain)
  }

  return polylines
}

// ── Area computation ────────────────────────────────────────

/**
 * Compute the signed area of a polygon using the shoelace formula.
 * Returns a positive value (absolute area).
 */
function polylineArea(pts: Point2D[]): number {
  if (pts.length < 3) return 0
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    area += pts[i].x * pts[j].y
    area -= pts[j].x * pts[i].y
  }
  return Math.abs(area) / 2
}

// ── Public API ──────────────────────────────────────────────

/** A group of isocurves generated by a single pass-through point. */
export interface IsocurveSet {
  polylines: Point2D[][]
  pathData: string[]
  threshold: number
  /** Total enclosed area (sum of all closed polyline areas in this set) */
  area: number
}

export interface MetaballResult {
  /** Isocurve sets sorted by area (smallest first) */
  sets: IsocurveSet[]
}

/**
 * Compute auto bounds from charges and all pass-through points.
 */
function autoBounds(charges: Point2D[], passThroughPoints: Point2D[], padding = 1.5) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

  const allPts = [...charges, ...passThroughPoints]
  for (const p of allPts) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const padX = rangeX * padding
  const padY = rangeY * padding
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  return {
    minU: cx - padX,
    maxU: cx + padX,
    minV: cy - padY,
    maxV: cy + padY,
  }
}

/**
 * Main entry point: compute metaball isocurves.
 *
 * The grid is sampled once, then for each pass-through point a
 * separate threshold is computed and segments are extracted. This
 * keeps the expensive grid-sampling step shared across all
 * pass-through points.
 *
 * @param charges            Array of 2D point-charge positions
 * @param passThroughPoints  Each point defines an isocurve (threshold = field(X))
 * @param accuracy           Grid step size (smaller = finer); null for auto
 */
export function computeMetaballIsocurves(
  charges: Point2D[],
  passThroughPoints: Point2D[],
  accuracy: number | null = null,
): MetaballResult {
  if (charges.length === 0 || passThroughPoints.length === 0) {
    return { sets: [] }
  }

  const plane = IDENTITY_PLANE

  // 1. Determine bounds from all points
  const bounds = autoBounds(charges, passThroughPoints)

  // 2. Determine step size
  const rangeU = bounds.maxU - bounds.minU
  const rangeV = bounds.maxV - bounds.minV
  const step = accuracy ?? Math.max(rangeU, rangeV) / 120

  // Guard against extremely small steps (performance)
  const minStep = Math.max(rangeU, rangeV) / 500
  const safeStep = Math.max(step, minStep)

  // 3. Sample grid ONCE
  const grid = sampleGrid(charges, plane, bounds, safeStep)

  // 4. For each pass-through point, extract an isocurve set
  const sets: IsocurveSet[] = []

  for (const pt of passThroughPoints) {
    const threshold = computeField(pt, charges)
    const segments = extractSegments(grid, threshold)
    const polylines = assemblePolylines(segments)
    const pathData = polylines.map(polylineToPathD)

    // Sum area of all closed polylines in this set
    const area = polylines.reduce((sum, pl) => {
      if (pl.length > 2 && ptEq(pl[0], pl[pl.length - 1])) {
        return sum + polylineArea(pl)
      }
      return sum
    }, 0)

    sets.push({ polylines, pathData, threshold, area })
  }

  // 5. Sort sets by area (smallest first)
  sets.sort((a, b) => a.area - b.area)

  return { sets }
}

/**
 * Convert a single polyline to an SVG path d-attribute string.
 */
function polylineToPathD(pts: Point2D[]): string {
  if (pts.length === 0) return ''
  const parts: string[] = [`M ${pts[0].x.toFixed(4)} ${pts[0].y.toFixed(4)}`]
  for (let i = 1; i < pts.length; i++) {
    parts.push(`L ${pts[i].x.toFixed(4)} ${pts[i].y.toFixed(4)}`)
  }
  // Close path if endpoints are close
  if (pts.length > 2 && ptEq(pts[0], pts[pts.length - 1])) {
    parts.push('Z')
  }
  return parts.join(' ')
}

/**
 * Convert multiple polylines to SVG path d strings.
 */
export function pathsToSVGPathData(polylines: Point2D[][]): string[] {
  return polylines.map(polylineToPathD)
}
