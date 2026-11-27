import * as THREE from 'three/webgpu';
import { color, instanceIndex, mix, mx_noise_float, normalWorld, positionLocal, positionWorld, uniform, vec3 } from 'three/tsl';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentState, Quality } from './types';
import { QUALITY } from './types';

function seeded(seed: number) { let s = seed | 0; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** Whorled branch geometry, reused by every pine. Silhouettes are asymmetric and open between branches. */
function pineGeometry(distant = false) {
  const positions: number[] = [], rnd = seeded(77);
  const tri = (a: number[], b: number[], c: number[]) => positions.push(...a, ...b, ...c);
  const tiers = distant ? 5 : 10;
  for (let tier = 0; tier < tiers; tier++) {
    const h = .17 + tier / (tiers - 1) * .702, radius = .24 * Math.pow(1 - h, .85);
    const branches = distant ? 3 : 5 + (tier % 3);
    for (let b = 0; b < branches; b++) {
      const angle = b / branches * Math.PI * 2 + tier * 2.399;
      const r = radius * (.78 + rnd() * .36), w = r * .45;
      const dx = Math.sin(angle), dz = Math.cos(angle);
      const tip = [dx * r, h - .035 + rnd() * .025, dz * r];
      const left = [dx * r * .45 + dz * w, h + .035, dz * r * .45 - dx * w];
      const right = [dx * r * .45 - dz * w, h + .035, dz * r * .45 + dx * w];
      const spine = [dx * r * .28, h + .11 * (1 - h), dz * r * .28];
      const root = [0, h - .025, 0];
      tri(tip, right, spine); tri(tip, spine, left); tri(root, left, spine); tri(root, spine, right); tri(root, right, tip); tri(root, tip, left);
    }
  }
  tri([-.025, .84, 0], [0, 1, 0], [.025, .84, 0]);
  tri([0, .84, -.025], [0, 1, 0], [0, .84, .025]);
  const branches = new THREE.BufferGeometry(); branches.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); branches.computeVertexNormals();
  const trunk = new THREE.CylinderGeometry(.009, .026, .88, 5).toNonIndexed(); trunk.translate(0, .44, 0); trunk.deleteAttribute('uv');
  const result = mergeGeometries([branches, trunk], false)!; branches.dispose(); trunk.dispose(); return result;
}

function rockGeometry(detail = 5) {
  // IcosahedronGeometry is non-indexed: computing its normals directly makes
  // every triangle visibly flat. Weld it before applying geological relief.
  const source = new THREE.IcosahedronGeometry(1, detail);
  source.deleteAttribute('uv'); source.deleteAttribute('normal');
  const g = mergeVertices(source, .00001); source.dispose();
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const relief = 1 + .12 * Math.sin(x * 5 + z * 3) * Math.cos(y * 4 - x * 2) + .028 * Math.cos(z * 11 + x * 8);
    p.setXYZ(i, x * relief, y * relief * .7 + Math.sin(x * 5 + z * 4) * .05, z * relief);
  }
  g.computeVertexNormals(); return g;
}

interface Skier { object: THREE.Group; route: THREE.Vector3[]; duration: number; offset: number; }

/** Vegetation, buried rocks and sparse life are regenerated separately from architecture. */
export class VegetationSystem {
  readonly group = new THREE.Group();
  private generated = new THREE.Group();
  private state: EnvironmentState;
  private materials: THREE.Material[] = [];
  private clock = uniform(0);
  private wind = uniform(new THREE.Vector3(.005, 0, .005));
  private snow = uniform(.86);
  private treeMaterial: THREE.MeshStandardNodeMaterial;
  private rockMaterial: THREE.MeshStandardNodeMaterial;
  private trackMaterial: THREE.MeshStandardNodeMaterial;
  private birdMaterial: THREE.MeshStandardNodeMaterial;
  private pathMaterial: THREE.MeshStandardNodeMaterial;
  private skierMaterials: THREE.MeshStandardNodeMaterial[];
  private skiers: Skier[] = [];
  private birds: THREE.Mesh[] = [];
  private dummy = new THREE.Object3D();
  private simulatedTime = 0;

  constructor(private scene: THREE.Scene, private heightAt: (x: number, z: number) => number, state: EnvironmentState) {
    this.state = { ...state }; this.group.name = 'Pine forests, glacial rocks and alpine life'; this.group.add(this.generated); scene.add(this.group);
    this.treeMaterial = new THREE.MeshStandardNodeMaterial({ roughness: .97, side: THREE.DoubleSide });
    const pineVariation = mx_noise_float(positionWorld.mul(.12)).mul(.12).add(.5);
    const foliage = mix(color(0x142a2a), color(0x36504b), pineVariation);
    const snowLaden = normalWorld.y.smoothstep(.2, .85).mul(this.snow).mul(.8);
    this.treeMaterial.colorNode = mix(foliage, color(0xc1d3d8), snowLaden);
    const phase = this.clock.mul(.7).add(instanceIndex.toFloat().mul(3.73)).add(positionLocal.y.mul(7));
    this.treeMaterial.positionNode = positionLocal.add(this.wind.mul(phase.sin().mul(positionLocal.y.pow(2))));
    this.rockMaterial = new THREE.MeshStandardNodeMaterial({ roughness: .96 });
    const strata = mx_noise_float(positionWorld.mul(vec3(1.8, 6, 1.8))).mul(.3).add(.5);
    const stone = mix(color(0x303a40), color(0x596268), strata);
    const snowMask = normalWorld.y.add(mx_noise_float(positionWorld.mul(2)).mul(.11)).smoothstep(.48, .84).mul(this.snow);
    this.rockMaterial.colorNode = mix(stone, color(0xe5edf0), snowMask);
    this.trackMaterial = new THREE.MeshStandardNodeMaterial({ color: 0xa5bdcd, roughness: 1, transparent: true, opacity: .38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.birdMaterial = new THREE.MeshStandardNodeMaterial({ color: 0x18242b, roughness: .9, side: THREE.DoubleSide });
    this.pathMaterial = new THREE.MeshStandardNodeMaterial({ color: 0xc0cfd7, transparent: true, opacity: .16, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.skierMaterials = [0x98614b, 0x365c70, 0x8f7860].map(c => new THREE.MeshStandardNodeMaterial({ color: c, roughness: .94 }));
    this.materials.push(this.treeMaterial, this.rockMaterial, this.trackMaterial, this.birdMaterial, this.pathMaterial, ...this.skierMaterials);
    this.generate();
  }

  private clearGenerated() {
    // Chunk instances share immutable geometries. Dispose each geometry exactly
    // once, while each mesh still releases its own instance matrix allocation.
    const geometries = new Set<THREE.BufferGeometry>();
    this.generated.traverse(o => { if (o instanceof THREE.Mesh) geometries.add(o.geometry); if (o instanceof THREE.InstancedMesh) o.dispose(); });
    geometries.forEach(g => g.dispose());
    this.generated.clear(); this.skiers = []; this.birds = [];
  }

  private generate() {
    this.clearGenerated();
    const rnd = seeded(this.state.seed + 714);
    const count = QUALITY[this.state.quality].trees;
    const treeCells = new Map<string, { matrices: THREE.Matrix4[]; distant: boolean }>();
    let added = 0;
    for (let attempt = 0; attempt < count * 18 && added < count; attempt++) {
      const a = rnd() * Math.PI * 2, r = 400 + Math.pow(rnd(), .7) * 4100;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = this.heightAt(x, z);
      // Irregular forest islands, gullies and a gradual upper tree line.
      const island = Math.sin(x * .003 + Math.sin(z * .002)) + Math.cos(z * .0037 - x * .001);
      if (y > -280 - rnd() * 140 || y < -1800 || island < -.65) continue;
      const dx = this.heightAt(x + 8, z) - this.heightAt(x - 8, z), dz = this.heightAt(x, z + 8) - this.heightAt(x, z - 8);
      if (Math.hypot(dx, dz) / 16 > .9) continue;
      const h = 5.5 + rnd() * 11;
      this.dummy.position.set(x, y - .12, z); this.dummy.rotation.set((rnd() - .5) * .035, rnd() * Math.PI * 2, (rnd() - .5) * .035); this.dummy.scale.set(h * (.84 + rnd() * .24), h, h); this.dummy.updateMatrix();
      const cx = Math.floor(x / 1000), cz = Math.floor(z / 1000), key = `${cx},${cz}`;
      const cell = treeCells.get(key) ?? { matrices: [], distant: Math.hypot(cx * 1000 + 500, cz * 1000 + 500) > 2300 };
      cell.matrices.push(this.dummy.matrix.clone()); treeCells.set(key, cell); added++;
    }
    // Forest cells can be culled independently. The far silhouette mesh retains
    // whorled branches but uses 112 instead of 376 triangles per tree.
    const treeGeometries = new Map<boolean, THREE.BufferGeometry>();
    for (const [key, cell] of treeCells) {
      if (!treeGeometries.has(cell.distant)) treeGeometries.set(cell.distant, pineGeometry(cell.distant));
      // The forest lies outside the cabin's local shadow volume; skip its
      // shadow-map sampling as well as its shadow casting.
      this.addInstances(`Pine forest / 1 km cell ${key}${cell.distant ? ' / distant LOD' : ''}`, treeGeometries.get(cell.distant)!, this.treeMaterial, cell.matrices, false, false, 3);
    }

    const rockCells = new Map<string, { matrices: THREE.Matrix4[]; shadow: boolean; detail: number }>();
    // Scattered in geological bands rather than uniform confetti. High foreground detail remains around the ridge.
    for (let i = 0; i < 520; i++) {
      const near = i < 180;
      const a = rnd() * Math.PI * 2, r = near ? 13 + Math.pow(rnd(), 1.7) * 125 : 160 + rnd() * 2200;
      let x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (near && x > 6 && x < 35 && z < -8 && z > -42) x = -x; // preserve foreground camera sightline
      const y = this.heightAt(x, z), scale = near ? .28 + Math.pow(rnd(), 2) * 2.9 : 2 + rnd() * 15;
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
      this.dummy.position.set(x, y - scale * .28, z); this.dummy.rotation.set(rnd() * .45, rnd() * 6.28, rnd() * .25); this.dummy.scale.set(scale * (1 + rnd() * .7), scale, scale * (.8 + rnd())); this.dummy.updateMatrix();
      const shadow = r < 100, cellSize = shadow ? 100 : 800, detail = r < 300 ? 5 : 2;
      const key = `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}/${detail}/${shadow}`;
      const cell = rockCells.get(key) ?? { matrices: [], shadow, detail };
      cell.matrices.push(this.dummy.matrix.clone()); rockCells.set(key, cell);
    }
    const rockGeometries = new Map<number, THREE.BufferGeometry>();
    for (const [key, cell] of rockCells) {
      if (!rockGeometries.has(cell.detail)) rockGeometries.set(cell.detail, rockGeometry(cell.detail));
      this.addInstances(`Buried granite / ${cell.shadow ? 'local shadow casters' : 'unshadowed distant outcrops'} / ${key}`, rockGeometries.get(cell.detail)!, this.rockMaterial, cell.matrices, cell.shadow, cell.shadow);
    }

    // Narrow approach path and alternating boot prints, recessed optically into the snow surface.
    const path: THREE.Vector3[] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, x = 5.8 + t * 85 + Math.sin(t * 7) * t * 3, z = 2.65 + t * 34 + Math.sin(t * 4) * 9;
      path.push(new THREE.Vector3(x, this.heightAt(x, z) + .035, z));
    }
    this.generated.add(this.ribbon(path, .7, this.pathMaterial));
    const footprintG = new THREE.CircleGeometry(.13, 9); footprintG.rotateX(-Math.PI / 2); footprintG.scale(.57, 1, 1.08);
    const prints = new THREE.InstancedMesh(footprintG, this.trackMaterial, 84);
    for (let i = 0; i < prints.count; i++) {
      const t = i / 180, x = 5.8 + t * 85 + Math.sin(t * 7) * t * 3 + (i % 2 ? .13 : -.13), z = 2.65 + t * 34 + Math.sin(t * 4) * 9;
      this.dummy.position.set(x, this.heightAt(x, z) + .045, z); this.dummy.rotation.set(0, -.9, 0); this.dummy.scale.set(1, 1, 1); this.dummy.updateMatrix(); prints.setMatrixAt(i, this.dummy.matrix);
    }
    prints.instanceMatrix.needsUpdate = true; this.generated.add(prints);

    // Downhill routes follow the terrain gradient; each skier leaves two continuous subtle grooves.
    for (let k = 0; k < 3; k++) {
      let x = -95 - k * 70, z = 100 + k * 70;
      const route: THREE.Vector3[] = [];
      for (let i = 0; i < 90; i++) {
        const y = this.heightAt(x, z); route.push(new THREE.Vector3(x, y + .13, z));
        const gx = (this.heightAt(x + 3, z) - this.heightAt(x - 3, z)) / 6, gz = (this.heightAt(x, z + 3) - this.heightAt(x, z - 3)) / 6;
        const gl = Math.hypot(gx, gz);
        if (gl < .02) break;
        const turn = Math.sin(i * .18 + k) * .55, dx = -gx / gl, dz = -gz / gl;
        x += (dx * Math.cos(turn) - dz * Math.sin(turn)) * 4.5; z += (dx * Math.sin(turn) + dz * Math.cos(turn)) * 4.5;
      }
      if (route.length < 15) continue;
      for (const offset of [-.18, .18]) {
        const shifted = route.map((p, i) => { const next = route[Math.min(i + 1, route.length - 1)], prev = route[Math.max(i - 1, 0)], dir = next.clone().sub(prev).normalize(); const xx = p.x + dir.z * offset, zz = p.z - dir.x * offset; return new THREE.Vector3(xx, this.heightAt(xx, zz) + .055, zz); });
        this.generated.add(this.ribbon(shifted, .075, this.trackMaterial));
      }
      const skier = this.makeSkier(k); this.generated.add(skier);
      this.skiers.push({ object: skier, route, duration: route.length * 1.4, offset: k * 29 });
    }

    const wings = new THREE.BufferGeometry();
    wings.setAttribute('position', new THREE.Float32BufferAttribute([-.03, 0, -.3, -.03, 0, .22, -.95, .12, .1, .03, 0, -.3, .95, .12, .1, .03, 0, .22], 3)); wings.computeVertexNormals();
    for (let i = 0; i < 4; i++) { const bird = new THREE.Mesh(wings.clone(), this.birdMaterial); bird.scale.setScalar(1.5); this.generated.add(bird); this.birds.push(bird); } wings.dispose();
  }

  private addInstances(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[], castShadow: boolean, receiveShadow: boolean, boundsPadding = 0) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.name = name; mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow; mesh.frustumCulled = true;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.computeBoundingBox();
    if (mesh.boundingSphere) mesh.boundingSphere.radius += boundsPadding;
    if (mesh.boundingBox) mesh.boundingBox.expandByScalar(boundsPadding);
    this.generated.add(mesh);
  }

  private ribbon(points: THREE.Vector3[], width: number, material: THREE.Material) {
    const p: number[] = [], indices: number[] = [];
    points.forEach((v, i) => {
      const tangent = points[Math.min(i + 1, points.length - 1)].clone().sub(points[Math.max(i - 1, 0)]).normalize();
      const side = new THREE.Vector3(tangent.z, 0, -tangent.x).multiplyScalar(width / 2);
      for (const s of [-1, 1]) { const x = v.x + side.x * s, z = v.z + side.z * s; p.push(x, this.heightAt(x, z) + .045, z); }
      if (i < points.length - 1) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(indices); g.computeVertexNormals(); const mesh = new THREE.Mesh(g, material); mesh.receiveShadow = true; return mesh;
  }

  private makeSkier(index: number) {
    const g = new THREE.Group(), jacket = this.skierMaterials[index];
    const parts: THREE.BufferGeometry[] = [];
    const body = new THREE.CapsuleGeometry(.19, .45, 3, 6).toNonIndexed(); body.translate(0, .94, 0); parts.push(body);
    const head = new THREE.SphereGeometry(.16, 8, 6).toNonIndexed(); head.translate(0, 1.5, -.12); parts.push(head);
    for (const s of [-1, 1]) { const leg = new THREE.BoxGeometry(.12, .6, .16).toNonIndexed(); leg.rotateX(-.3); leg.translate(s * .17, .4, 0); parts.push(leg); const ski = new THREE.BoxGeometry(.1, .035, 1.75).toNonIndexed(); ski.translate(s * .19, .05, -.25); parts.push(ski); }
    const mesh = new THREE.Mesh(mergeGeometries(parts, false)!, jacket); parts.forEach(p => p.dispose()); g.add(mesh); return g;
  }

  update(state: EnvironmentState, elapsed: number) {
    if (!state.paused) this.simulatedTime = elapsed;
    this.state = { ...state }; this.clock.value = this.simulatedTime;
    const angle = state.windDirection * Math.PI / 180, amplitude = .003 + state.windSpeed * .0025;
    this.wind.value.set(Math.cos(angle) * amplitude, 0, Math.sin(angle) * amplitude); this.snow.value = state.snowCoverage;
    const storm = state.weather === 'Snowstorm';
    this.skiers.forEach(s => {
      s.object.visible = !storm && state.time > 7 && state.time < 17;
      const t = ((this.simulatedTime + s.offset) % s.duration) / s.duration * (s.route.length - 1), i = Math.floor(t), f = t - i;
      const p = s.route[i], next = s.route[Math.min(i + 1, s.route.length - 1)], direction = next.clone().sub(p);
      s.object.position.lerpVectors(p, next, f); s.object.rotation.set(-Math.atan2(direction.y, Math.hypot(direction.x, direction.z)) * .4, Math.atan2(-direction.x, -direction.z), Math.sin(t * .18) * .18);
    });
    this.birds.forEach((bird, i) => {
      const t = this.simulatedTime * .024 + i * 1.8, r = 240 + i * 75;
      bird.position.set(Math.cos(t) * r - 150, 70 + i * 22 + Math.sin(t * 2) * 18, 500 + Math.sin(t) * r);
      bird.rotation.set(Math.sin(t) * .1, -t + Math.PI / 2, -.18 + Math.sin(t * 2) * .12); bird.visible = !storm && state.time > 6 && state.time < 20;
    });
  }

  regenerate(seed: number) { this.state.seed = seed; this.generate(); }
  setQuality(quality: Quality) { if (this.state.quality === quality) return; this.state.quality = quality; this.generate(); }
  dispose() { this.scene.remove(this.group); this.clearGenerated(); this.materials.forEach(m => m.dispose()); }
}
