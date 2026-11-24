import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Box3, Raycaster, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { homeDisplay } from '../src/components/sumiyoshi/world.ts'

const bytes = readFileSync(new URL('../public/sumiyoshi/models/house.glb', import.meta.url))
const loader = new GLTFLoader()
// Geometry checks run in Node without a browser image decoder.
loader.register(() => ({ name: 'geometry-only', loadTexture: () => Promise.resolve(new Texture()) }))
const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
scene.updateMatrixWorld(true)

function boundsOf(matches) {
  const bounds = new Box3()
  scene.traverse(node => { if (node.isMesh && matches(node.name)) bounds.expandByObject(node) })
  assert.ok(!bounds.isEmpty(), 'expected a named mesh in the exported home')
  return bounds
}

test('the exported lounge ceiling spans the sofa, sea window and rear entrance', () => {
  const { min, max } = boundsOf(name => name?.startsWith('Ceiling_Lounge') && /shell/i.test(name))
  assert.ok(min.x <= -5.2 && max.x >= 5.2)
  assert.ok(min.z <= -3.6 && max.z >= 4.15)
  assert.ok(min.y >= 3 && min.y < 3.5)
})

test('the runtime screen sits flush in front of the modeled television', () => {
  const { min, max } = boundsOf(name => name === 'TVDisplaySlot')
  const near = (actual, target) => assert.ok(Math.abs(actual - target) < .012, `${actual} ≠ ${target}`)
  near((min.x + max.x) / 2, homeDisplay.x)
  near((min.y + max.y) / 2, homeDisplay.y)
  near(max.x - min.x, homeDisplay.width)
  near(max.y - min.y, homeDisplay.height)
  assert.ok(homeDisplay.z > max.z && homeDisplay.z - max.z < .02)
})

test('every side of the lounge closes against the underside of the ceiling', () => {
  const ray = new Raycaster()
  for (const y of [3.225, 3.265, 3.295]) {
    for (const [x, z] of [[0, 0], [-4.9, -3.4], [4.9, -3.4], [-4.9, 3.8], [4.9, 3.8]]) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ray.set(new Vector3(x, y, z), new Vector3(dx, 0, dz))
        assert.ok(ray.intersectObject(scene).length, `Open joint at height ${y} from (${x}, ${z}) toward (${dx}, ${dz})`)
      }
    }
  }
})
