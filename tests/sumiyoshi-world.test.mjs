import assert from 'node:assert/strict'
import test from 'node:test'
import { PerspectiveCamera, Vector3 } from 'three'
import { artworkWidth, loungeViewport, pixelViewport } from '../src/components/sumiyoshi/pixelViewport.ts'
import { placeHomeWalkCamera } from '../src/components/sumiyoshi/homeWalkCamera.ts'
import {
  areas, cafeSpawn, distance, forestCenterX, homeDisplay, homeSpawn, members, nearby, pickStop,
  slideMove, stops, walkable, walkPath,
} from '../src/components/sumiyoshi/world.ts'

test('the lounge enlarges pixels evenly on desktop and handsets', () => {
  assert.deepEqual(loungeViewport(1280, 612), { width: 427, height: 204 })
  assert.deepEqual(loungeViewport(390, 736), { width: 195, height: 368 })
  assert.deepEqual(loungeViewport(390, 844), { width: 195, height: 422 })
  assert.deepEqual(loungeViewport(1, 1), { width: 1, height: 1 })
})

test('the detailed artwork preserves framing, with two lighter raster options', () => {
  assert.equal(artworkWidth(null), 960)
  assert.equal(artworkWidth('640'), 640)
  assert.equal(artworkWidth('480'), 480)
  assert.deepEqual(pixelViewport(1280, 720), { width: 960, height: 540 })
  assert.deepEqual(pixelViewport(390, 844), { width: 390, height: 844 })
  assert.deepEqual(pixelViewport(600, 1200), { width: 432, height: 864 })
  assert.deepEqual(pixelViewport(480, 270), { width: 480, height: 270 })
  assert.deepEqual(pixelViewport(1280, 720, 640), { width: 640, height: 360 })
  assert.deepEqual(pixelViewport(1280, 720, 480), { width: 480, height: 270 })
  assert.deepEqual(pixelViewport(390, 844, 640), { width: 240, height: 520 })
  assert.deepEqual(pixelViewport(390, 736, 640), { width: 276, height: 520 })
})

test('the Forest entrance is in the recessed bay to the right of the facade axis', () => {
  const door = stops['cafe-entry']
  assert.ok(Math.abs(door.point.x - forestCenterX - 1.06) < 1e-6)
  assert.equal(pickStop('street', { x: forestCenterX, z: door.point.z }), null)
  assert.equal(door.approach.x, door.point.x)
  assert.equal(door.spawn.x, door.point.x)
})

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

test('the walker slides around the sofa and cannot cross furniture, people or the sea window', () => {
  const edge = { x: 1.93, z: 1.15 }
  assert.deepEqual(slideMove('home', edge, -0.25, 0.25), { x: 1.93, z: 1.4 })
  assert.deepEqual(slideMove('home', homeSpawn, -5, 0), homeSpawn)
  assert.equal(nearby('home', { x: -1.35, z: 2.19 }), 'sofa')
  assert.deepEqual(walkPath('home', homeSpawn, { x: 0, z: -3.4 }), [])
  assert.deepEqual(walkPath('street', stops['home-entry'].spawn, { x: 0, z: 6 }), [])
  assert.deepEqual(walkPath('cafe', cafeSpawn, { x: 4.48, z: -2.75 }), [])
  for (const station of members) assert.equal(walkable('cafe', station.point), false)
  assert.equal(pickStop('street', { x: -5, z: 3 }), null)
  assert.equal(nearby('street', { x: 21, z: 3 }), null)
})

test('the lounge furniture has solid footprints and the sea window is reachable on either side of the TV', () => {
  const occupied = [[-.71,-.47], [-3.31,-1.05], [-1.84,1.23], [-4.06,3.88], [-2.09,-1.38],
    [2,-3.51], [homeDisplay.x,-2.48]]
  for (const [x,z] of occupied) assert.equal(walkable('home',{x,z}),false)
  for (const point of [{x:-1.4,z:-2.81}, {x:4.12,z:-2.84}, {x:-4.70,z:2.87}]) {
    follow('home',homeSpawn,point)
    follow('home',point,stops['home-door'].approach)
  }
})

test('both walking cameras remain indoors and frame a standing visitor throughout the lounge', () => {
  const target = new Vector3()
  const [left, right, back, front] = areas.home.bounds
  for (const aspect of [1280/720, 390/844]) for (const elevated of [false,true]) {
    const cam = new PerspectiveCamera(45,aspect,.035,95)
    for (let x=left; x<=right; x+=.28) for (let z=back; z<=front; z+=.28) {
      if (!walkable('home',{x,z})) continue
      cam.fov = placeHomeWalkCamera(cam.position,target,{x,z},aspect<.87,elevated)
      cam.lookAt(target)
      cam.updateProjectionMatrix()
      cam.updateMatrixWorld()
      assert.ok(cam.position.y>1.7 && cam.position.y<3.12, 'eye and near plane stay below the ceiling')
      assert.ok(Math.abs(cam.position.x)<5.22 && cam.position.z<4.14 && cam.position.z>-3.50, 'inside wall finishes')
      assert.ok(target.z<cam.position.z, 'screen-up keeps its oceanward direction')
      for (const height of [.03,1.72]) {
        const point = new Vector3(x,height,z).project(cam)
        assert.ok(Math.abs(point.x)<.90 && Math.abs(point.y)<.90 && point.z<1 && point.z>-1, 'feet and head are in frame')
      }
    }
  }
})

test('standing up immediately reveals the plaster ceiling over the sea window', () => {
  for (const aspect of [1280/720,390/844]) {
    const camera = new PerspectiveCamera(45,aspect,.035,95), aim = new Vector3()
    camera.fov = placeHomeWalkCamera(camera.position,aim,homeSpawn,aspect<.87,false)
    camera.lookAt(aim)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    const corner = new Vector3(homeDisplay.x,3.30,-3.60).project(camera)
    assert.ok(corner.y < .90 && corner.y > .50, 'the junction leaves a visible band of ceiling at the top')
  }
})
