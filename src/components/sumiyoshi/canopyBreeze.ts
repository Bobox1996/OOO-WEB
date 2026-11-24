import { BufferAttribute, Mesh, type BufferGeometry, type Material, type Object3D } from 'three'

// Each separate spray has its own root, even after a Blender batch combines many
// plants into one mesh. Resolve the connected vertices once, independently of the UV atlas.
function leafTravel(geometry: BufferGeometry) {
  const positions = geometry.getAttribute('position')
  const count = positions.count
  const parent = Int32Array.from({length: count}, (_, i) => i)
  function root(i: number) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const indices = geometry.index
  const corners = indices?.count ?? count
  for (let i = 0; i < corners; i += 3) {
    const a = root(indices ? indices.getX(i) : i)
    parent[root(indices ? indices.getX(i + 1) : i + 1)] = a
    parent[root(indices ? indices.getX(i + 2) : i + 2)] = a
  }
  const base = new Float32Array(count).fill(Infinity)
  const top = new Float32Array(count).fill(-Infinity)
  for (let i = 0; i < count; i++) {
    const island = root(i), y = positions.getY(i)
    parent[i] = island
    base[island] = Math.min(base[island], y)
    top[island] = Math.max(top[island], y)
  }
  const travel = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const island = parent[i], height = top[island] - base[island]
    if (height <= 0) continue
    const fraction = (positions.getY(i) - base[island]) / height
    travel[i] = fraction * fraction * Math.min(.024, height * .026)
  }
  return new BufferAttribute(travel, 1)
}

export function createCanopyBreeze() {
  const clock = {value: -1}
  const bound = new WeakSet<Material>()
  return {
    attach(model: Object3D) {
      model.traverse(mesh => {
        if (!(mesh instanceof Mesh)) return
        const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const material of materials) {
          if (!material.name.startsWith('Botanical ')) continue
          if (!mesh.geometry.hasAttribute('leafTravel')) mesh.geometry.setAttribute('leafTravel', leafTravel(mesh.geometry))
          if (bound.has(material)) continue
          bound.add(material)
          const original = material.onBeforeCompile
          material.onBeforeCompile = (shader, renderer) => {
            original.call(material, shader, renderer)
            shader.uniforms.canopyTime = clock
            shader.vertexShader = 'attribute float leafTravel;\nuniform float canopyTime;\n' + shader.vertexShader
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
              #include <begin_vertex>
              if (canopyTime >= 0.0) {
                vec3 rest = (modelMatrix * vec4(position, 1.0)).xyz;
                float phase = dot(rest.xz, vec2(0.36, 0.17));
                float drift = 0.74 * sin(canopyTime * 0.83 + phase)
                            + 0.26 * sin(canopyTime * 1.27 + phase * 1.6 + 0.4 * rest.y);
                transformed.xz += vec2(1.0, 0.23) * drift * leafTravel;
              }`)
          }
          material.needsUpdate = true
        }
      })
    },
    update(seconds: number, reducedMotion: boolean) {
      clock.value = reducedMotion ? -1 : seconds
    },
  }
}
