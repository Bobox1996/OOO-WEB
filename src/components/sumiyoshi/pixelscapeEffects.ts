import * as T from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { seeded } from '../drive-in/geometry'

type RainArea = 'home' | 'street'
type WaterPatch = [left: number, right: number, back: number, front: number, elevation: number]
export const display = {width: 3.32, height: 1.8675, y: 1.59, z: -2.392}

// These planes lie on the finish of the asphalt, basalt and courtyard water.
// A single mirror probe covers the entire visible area, including its separate pools.
function waterGeometry(patches: WaterPatch[], elevation: number) {
  const xyz: number[] = []
  const indices: number[] = []
  for (const [left, right, back, front, level] of patches) {
    const i = xyz.length / 3
    xyz.push(left, -front, level - elevation, right, -front, level - elevation,
      right, -back, level - elevation, left, -back, level - elevation)
    indices.push(i, i + 1, i + 2, i, i + 2, i + 3)
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(xyz, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

const waterShader = {
  name: 'Reflected streets and polished stone',
  uniforms: {
    color: {value: new T.Color()}, tDiffuse: {value: null}, textureMatrix: {value: new T.Matrix4()},
    time: {value: 0}, street: {value: 0}, texel: {value: new T.Vector2()},
    leftEmission: {value: new T.Color(0)}, rightEmission: {value: new T.Color(0)},
  },
  vertexShader: `
    varying vec4 reflectedUv;
    varying vec3 worldPoint;
    uniform mat4 textureMatrix;
    void main() {
      reflectedUv = textureMatrix * vec4(position, 1.0);
      worldPoint = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    varying vec4 reflectedUv;
    varying vec3 worldPoint;
    uniform sampler2D tDiffuse;
    uniform float time, street;
    uniform vec2 texel;
    uniform vec3 leftEmission, rightEmission;

    float hash(vec2 p) {
      vec3 v = fract(vec3(p.xyx) * .1031);
      v += dot(v, v.yzx + 33.33);
      return fract((v.x + v.y) * v.z);
    }
    float noise(vec2 p) {
      vec2 cell = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(cell), hash(cell + vec2(1,0)), f.x),
        mix(hash(cell + vec2(0,1)), hash(cell + vec2(1,1)), f.x), f.y);
    }
    void main() {
      vec2 p = worldPoint.xz;
      bool lounge = street < .5 && p.y > -2.87;
      float raw = .65 * noise(p * vec2(.61, 1.02)) + .35 * noise(p * vec2(1.53, 2.06));
      // Asphalt pools collect along the gutter and in irregular shallow depressions.
      float gutter = exp(-3.8 * abs(p.y - 1.0));
      float wet = street > .5 ? smoothstep(.30, .66, raw + .24 * gutter) : 1.0;
      if (street > .5 && wet < .015) discard;

      vec2 uv = reflectedUv.xy / reflectedUv.w;
      float clock = floor(time * 13.0) / 13.0;
      float stripe = floor(p.y * 22.0);
      float band = noise(vec2(p.x * 1.35 + .47 * clock, stripe));
      float small = noise(vec2(p.x * 4.4 - .55 * clock, floor(p.y * 46.0)));
      // Unresolved ripples converge to their mean under a distant/steep camera.
      // This keeps a two-centimetre wave from flashing on alternate pixel rows.
      float footprint = fwidth(p.y);
      band = mix(band, .50, smoothstep(.025, .11, footprint));
      small = mix(small, .50, smoothstep(.016, .06, footprint));
      vec2 offset = vec2(0.);
      float crest = 0.0;
      if (!lounge) {
        vec2 cell = floor(p * 1.55);
        float salt = hash(cell);
        vec2 center = vec2(.28 + .44 * salt, .28 + .44 * hash(cell + 9.1));
        vec2 delta = fract(p * 1.55) - center;
        float radius = length(delta);
        float age = fract(clock * (.43 + .24 * salt) + hash(cell + 3.4));
        float width = clamp(fwidth(radius) * 1.05, .016, .083);
        float ring = 1.0 - smoothstep(0., width, abs(radius - age * .30));
        crest = ring * (1.0 - age) * step(.12, age) * step(.61, salt);
        offset = vec2((band - .5) * 4.7 + (small - .5) * 1.4,
          (small - .5) * 1.8 + sin(p.x * 3. + clock) * .28) * texel;
        offset += texel * crest * delta / max(radius, .01);
      }
      uv = clamp(uv + offset, texel, 1.0 - texel);
      vec3 reflected = texture2D(tDiffuse, uv).rgb;
      vec3 broad = .5 * (texture2D(tDiffuse, uv + vec2(1.5 * texel.x, 0.)).rgb
                        + texture2D(tDiffuse, uv - vec2(1.5 * texel.x, 0.)).rgb);
      reflected = mix(reflected, broad, lounge ? .65 : .30);
      vec3 eye = normalize(cameraPosition - worldPoint);
      float grazing = pow(1. - clamp(eye.y, 0., 1.), 1.7);
      float intensity = dot(reflected, vec3(.2126,.7152,.0722));
      float opacity;
      if (lounge) {
        // A honed stone finish spreads the edge of a large rectangular light.
        // Trace the reflection direction to the actual TV plane, then measure
        // its angular distance from the emitter. The wider lobe carries the
        // active picture's colour onto stone that misses a perfect mirror ray.
        vec3 reflectedRay = reflect(-eye, vec3(0.,1.,0.));
        if (reflectedRay.z < -.02) {
          float travel = (${display.z} - worldPoint.z) / reflectedRay.z;
          if (travel > 0. && travel < 9.) {
            vec2 atDisplay = (worldPoint + travel * reflectedRay).xy - vec2(0.,${display.y});
            vec2 miss = max(abs(atDisplay) - vec2(${display.width/2},${display.height/2}), vec2(0.));
            float roughness = .17 + .27 * travel;
            float sheen = exp(-dot(miss,miss) / (2. * roughness * roughness));
            vec3 colour = mix(leftEmission, rightEmission, smoothstep(-1.1,1.1,atDisplay.x));
            reflected += .48 * sheen * colour;
          }
        }
        opacity = (.17 + .29 * grazing) * (.82 + .18 * raw);
      } else {
        float breaks = .48 + .52 * smoothstep(.18, .6, band);
        opacity = wet * (.31 + .40 * grazing + .13 * smoothstep(.06, .5, intensity)) * breaks;
        reflected += vec3(.013, .034, .039) * crest * (.34 + smoothstep(.04,.46,intensity));
      }
      gl_FragColor = vec4(reflected * vec3(.87,.95,.98), opacity);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}

function wetSurface(scene: T.Scene, area: RainArea) {
  const street = area === 'street'
  const base = street ? -.029 : .012
  const patches: WaterPatch[] = street
    ? [[-26, 26, 1.04, 14, base]]
    : [[-5.3, 5.3, -2.83, 4.16, base], [-4.85, 4.85, -3.81, -2.90, .112],
      [-1.90, 1.60, -6.0, -4.30, .111]]
  const mirror = new Reflector(waterGeometry(patches, base), {
    textureWidth: 320, textureHeight: 180, clipBias: .002, multisample: 0, shader: waterShader,
  })
  mirror.name = street ? 'Water_RoadDepressions' : 'Water_BasaltAndCourt'
  mirror.rotation.x = -Math.PI / 2
  mirror.position.y = base
  mirror.renderOrder = 1
  const material = mirror.material as T.ShaderMaterial
  const uniforms = material.uniforms
  uniforms.street.value = Number(street)
  material.transparent = true
  material.depthWrite = false
  const target = mirror.getRenderTarget()
  target.texture.type = T.UnsignedByteType
  target.texture.minFilter = T.NearestFilter
  target.texture.magFilter = T.NearestFilter
  const size = new T.Vector2()
  const view = new T.Matrix4(), projection = new T.Matrix4()
  let lastTime = -Infinity, lastRevision = -1
  const drawReflection = mirror.onBeforeRender
  mirror.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
    renderer.getDrawingBufferSize(size)
    const ratio = Math.min(1, 320 / Math.max(size.x, size.y))
    const w = Math.max(1, Math.round(size.x * ratio)), h = Math.max(1, Math.round(size.y * ratio))
    const resized = target.width !== w || target.height !== h
    const now = performance.now()
    const revision = scene.userData.televisionRevision || 0
    if (lastRevision !== revision && scene.userData.televisionEmission) {
      const [left,right] = scene.userData.televisionEmission as T.Color[]
      uniforms.leftEmission.value.copy(left)
      uniforms.rightEmission.value.copy(right)
    }
    const moved = !view.equals(camera.matrixWorld) || !projection.equals(camera.projectionMatrix)
    // Cache a still composition; projected UVs remain world-anchored between captures.
    if (!resized && lastRevision === revision && now - lastTime < (moved ? 82 : 470)) return
    if (resized) target.setSize(w, h)
    uniforms.texel.value.set(1 / w, 1 / h)
    drawReflection.call(this, renderer, scene, camera, geometry, material, group)
    view.copy(camera.matrixWorld)
    projection.copy(camera.projectionMatrix)
    lastTime = now
    lastRevision = revision
  }
  scene.add(mirror)
  return {update(time: number) {uniforms.time.value = time}, dispose() {target.dispose()}}
}

function fallingRain(scene: T.Scene, area: RainArea) {
  const home = area === 'home', random = seeded(home ? 655 : 182)
  const count = home ? 165 : 530
  const positions = new Float32Array(count * 6), tails = new Float32Array(count * 2)
  const drops = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    const x = (random() - .5) * (home ? 13 : 53), y = random() * 8
    const z = home ? -4.1 - random() * 7 : -.75 + random() * 8
    const length = .085 + random() * .115, speed = 3.8 + random() * 2.7
    for (let j = 0; j < 2; j++) {
      const v = i * 2 + j
      positions.set([x, y, z], v * 3)
      drops.set([length, speed], v * 2)
      tails[v] = j
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3))
  geometry.setAttribute('tail', new T.BufferAttribute(tails, 1))
  geometry.setAttribute('drop', new T.BufferAttribute(drops, 2))
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: {time: {value: 0}, street: {value: Number(!home)}},
    vertexShader: `
      uniform float time, street;
      attribute vec2 drop;
      attribute float tail;
      varying float strength, amber;
      void main() {
        vec3 p = position;
        float height = mod(p.y - floor(time * 20.) * .05 * drop.y, 8.0);
        p += vec3(.056 * (8.0 - height) + tail * .014, height - p.y - tail * drop.x, 0.0);
        amber = street * max(exp(-.56 * abs(p.x + 11.8)), .72 * exp(-.62 * abs(p.x - 14.5)));
        strength = (.11 + .12 * (1. - tail) + amber * .15) * (.66 + .30 * (drop.y - 3.8) / 2.7);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.);
      }`,
    fragmentShader: `
      varying float strength, amber;
      void main() {
        gl_FragColor = vec4(mix(vec3(.16,.38,.44), vec3(.83,.68,.37), amber), strength);
        #include <colorspace_fragment>
      }`,
  })
  const rain = new T.LineSegments(geometry, material)
  rain.name = 'Rain_Falling'
  rain.frustumCulled = false
  rain.renderOrder = 2
  scene.add(rain)
  return (time: number) => {material.uniforms.time.value = time}
}

function windowRunoff(scene: T.Scene) {
  // Narrow fixed tracks on the garden side of the sheet glass, concentrated
  // at the two mullions. Only a few of the adhered drops creep down at once.
  const random = seeded(7720), xyz: number[] = [], props: number[] = []
  for (let i = 0; i < 63; i++) {
    const side = i % 2 ? -1 : 1
    const x = side * (2.95 + 1.90 * random()), y = .27 + 2.55 * random()
    const length = .022 + .083 * random() ** 2, drift = random() * .013 - .006
    const moving = i % 8 === 0 ? .15 + .55 * random() : 0
    xyz.push(x, y + length, -3.743, x + drift, y, -3.743)
    const phase = random(), strength = .11 + .12 * random()
    props.push(moving, phase, strength * .33, moving, phase, strength)
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position',new T.Float32BufferAttribute(xyz,3))
  geometry.setAttribute('stream',new T.Float32BufferAttribute(props,3))
  const material = new T.ShaderMaterial({
    transparent:true, depthWrite:false, toneMapped:false, uniforms:{time:{value:0}},
    vertexShader:`
      attribute vec3 stream;
      uniform float time;
      varying float alpha;
      void main() {
        vec3 p = position;
        float phase = fract(time * .075 + stream.y);
        p.y -= stream.x * smoothstep(.08,.82,phase);
        alpha = stream.z;
        if (stream.x > 0.) alpha *= smoothstep(.02,.13,phase) * (1. - smoothstep(.77,.98,phase));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.);
      }`,
    fragmentShader:`
      varying float alpha;
      void main() {
        gl_FragColor = vec4(.36,.58,.62,alpha);
        #include <colorspace_fragment>
      }`,
  })
  const runoff = new T.LineSegments(geometry,material)
  runoff.name = 'Rain_GlazingEdges'
  runoff.renderOrder = 3
  scene.add(runoff)
  return (time:number) => {material.uniforms.time.value = time}
}

export function rainField(scene: T.Scene, area: RainArea) {
  const water = wetSurface(scene, area), rain = fallingRain(scene, area)
  const glass = area === 'home' ? windowRunoff(scene) : null
  return Object.assign((time: number) => {
    water.update(time)
    rain(time)
    glass?.(time)
  }, {dispose: water.dispose})
}
