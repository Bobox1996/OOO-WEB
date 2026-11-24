import assert from 'node:assert/strict'
import test from 'node:test'
import {
  areas, cafeSpawn, distance, homeSpawn, members, nearby, pickStop,
  slideMove, stops, walkable, walkPath,
} from '../src/components/sumiyoshi/world.ts'

function follow(area, start, end) {
  const route = walkPath(area, start, end)
  assert.ok(route.length > 0, `no path in ${area}: ${JSON.stringify(start)} → ${JSON.stringify(end)}`)
  let walker = start
  for (const corner of route) {
    const n = Math.max(1, Math.ceil(distance(walker, corner) / 0.08))
    const dx = (corner.x - walker.x) / n, dz = (corner.z - walker.z) / n
    for (let i = 0; i < n; i++) {
      walker = slideMove(area, walker, dx, dz)
      assert.ok(walkable(area, walker), 'every interpolated step must be collision-free')
    }
    assert.ok(distance(walker, corner) < 0.000001, 'navigation must agree with keyboard collision')
  }
  assert.ok(distance(walker, end) < 0.000001)
}

test('every approach can be walked to, selected and reached from every other station in its area', () => {
  for (const [area, layout] of Object.entries(areas)) {
    for (const id of layout.stops) {
      const { point, approach, spawn } = stops[id]
      assert.equal(pickStop(area, point), id)
      assert.equal(nearby(area, approach), id)
      assert.ok(walkable(area, spawn))
      for (const other of layout.stops) follow(area, spawn, stops[other].approach)
    }
  }
})

test('the 7 cafe encounters, vending machine and both door pairs form a complete trip from the sofa', () => {
  let area = 'home', walker = homeSpawn
  const interactions = []
  const itinerary = ['home-door', 'vision', 'cafe-entry', ...members.map(member => member.id),
    'cafe-door', 'home-entry', 'sofa']
  for (const id of itinerary) {
    const station = stops[id]
    assert.equal(area, station.area)
    follow(area, walker, station.approach)
    assert.equal(nearby(area, station.approach), id)
    walker = station.approach
    if (station.action.kind === 'door') {
      const reverse = stops[station.action.arrival]
      assert.deepEqual(reverse.action, { kind: 'door', arrival: id })
      area = reverse.area
      walker = reverse.spawn
      if (area === 'cafe') assert.deepEqual(walker, cafeSpawn)
    } else interactions.push(station.action)
  }
  assert.equal(area, 'home')
  assert.deepEqual(interactions, [
    { kind: 'vision' }, ...Array.from({ length: 7 }, (_, index) => ({ kind: 'member', index })), { kind: 'sofa' },
  ])
})

test('the walker slides around the sofa and cannot cross tables, people, walls or the water court', () => {
  const edge = { x: 1.93, z: 1.15 }
  assert.deepEqual(slideMove('home', edge, -0.25, 0.25), { x: 1.93, z: 1.4 })
  assert.deepEqual(slideMove('home', homeSpawn, -5, 0), homeSpawn)
  assert.equal(nearby('home', { x: -2, z: 1 }), 'sofa')
  assert.deepEqual(walkPath('home', homeSpawn, { x: 0, z: -3.4 }), [])
  assert.deepEqual(walkPath('street', stops['home-entry'].spawn, { x: 0, z: 6 }), [])
  assert.deepEqual(walkPath('cafe', cafeSpawn, { x: 4.48, z: -2.75 }), [])
  for (const station of members) assert.equal(walkable('cafe', station.point), false)
  assert.equal(pickStop('street', { x: -5, z: 3 }), null)
  assert.equal(nearby('street', { x: 21, z: 3 }), null)
})
