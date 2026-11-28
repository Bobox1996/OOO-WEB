import * as THREE from 'three/webgpu';
import { color, instancedBufferAttribute, mix, mx_noise_float, positionLocal, positionWorld, uniform, uv, vec3 } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { EnvironmentState } from './types';

/** Local cabin coordinates are metres; +Y is up and the glazed elevation faces -Z. */
export const CABIN_BOUNDARY = { minX: -11, maxX: 11, minZ: -11, maxZ: 8 };
export const DEFAULT_CABIN_CONFIG = { width: 7.5, depth: 9, eaves: 3.6, ridge: 6.05, floor: .58, orientation: 0 };
export type CabinConfig = typeof DEFAULT_CABIN_CONFIG;

/** An independently replaceable architectural assembly. No terrain is owned or regenerated here. */
export class CabinSystem {
  readonly group = new THREE.Group();
  readonly configuration = { ...DEFAULT_CABIN_CONFIG };
  private materials: THREE.Material[] = [];
  private batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private lamps: THREE.PointLight[] = [];
  private warmSurfaces: THREE.MeshStandardNodeMaterial[] = [];
  private snowMeshes: THREE.Object3D[] = [];
  private smoke: THREE.Mesh;
  private smokeMaterial: THREE.SpriteNodeMaterial;
  private smokePositions = new THREE.InstancedBufferAttribute(new Float32Array(32 * 3), 3);
  private smokeScales = new THREE.InstancedBufferAttribute(new Float32Array(32 * 2), 2);
  private smokeDensities = new THREE.InstancedBufferAttribute(new Float32Array(32), 1);
  private smokeTime = uniform(0);
  private smokeClock = 0;
  private fire: THREE.Mesh;
  private constructorHeight: number;

  constructor(private scene: THREE.Scene, heightAt: (x: number, z: number) => number) {
    this.group.name = 'Cabin — replaceable local architecture';
    this.constructorHeight = heightAt(0, 0);
    this.group.position.y = this.constructorHeight;
    scene.add(this.group);

    const material = (parameters: THREE.MeshStandardMaterialParameters) => {
      const m = new THREE.MeshStandardNodeMaterial(parameters); this.materials.push(m); return m;
    };
    const wood = material({ color: 0x65503b, roughness: .86 });
    wood.colorNode = mix(color(0x47382d), color(0x8c7051), mx_noise_float(positionLocal.mul(vec3(14, .35, 5))).mul(.35).add(.53));
    const woodWarm = material({ color: 0xa27746, roughness: .88, emissive: 0xe77d2b, emissiveIntensity: .035 });
    woodWarm.colorNode = mix(color(0x705035), color(0xb08a60), mx_noise_float(positionLocal.mul(vec3(4, .3, 10))).mul(.3).add(.55));
    this.warmSurfaces.push(woodWarm);
    const metal = material({ color: 0x242c2f, roughness: .55, metalness: .66 });
    const edge = material({ color: 0x141d20, roughness: .48, metalness: .7 });
    const stone = material({ color: 0x747575, roughness: .98 });
    stone.colorNode = mix(color(0x454c50), color(0x8b8980), mx_noise_float(positionWorld.mul(7)).mul(.26).add(.58));
    const snow = material({ color: 0xe7f0f2, roughness: .93 });
    snow.colorNode = mix(color(0xd5e4ea), color(0xf8f8ef), mx_noise_float(positionWorld.mul(42)).mul(.025).add(.87));
    const upholstery = material({ color: 0xb4a38e, roughness: .96 });
    const charcoal = material({ color: 0x2e302d, roughness: .85 });
    const book = material({ color: 0xa66c3d, roughness: .95 });
    const lamp = material({ color: 0xffd09b, emissive: 0xffac59, emissiveIntensity: 3, roughness: .6 });
    this.warmSurfaces.push(lamp);
    const glass = new THREE.MeshPhysicalNodeMaterial({ color: 0xc9e1e1, roughness: .075, metalness: 0, transparent: true, opacity: .13, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: .08 });
    this.materials.push(glass);

    // Foundations extend well below the graded terrain; their tops support the floor and deck.
    this.box(7.65, 1.75, 9.15, 0, -.45, 0, stone);
    this.box(7.75, .25, 9.25, 0, .46, 0, edge);
    this.box(7.35, .16, 8.85, 0, .65, 0, woodWarm);
    for (let x = -3.6; x < 3.6; x += .28) this.box(.012, .008, 8.8, x, .736, 0, wood);

    // Side elevations and individually expressed vertical timber battens.
    this.box(.18, 3.03, 9, -3.75, 2.17, 0, wood);
    this.box(.18, 3.03, 9, 3.75, 2.17, 0, wood);
    this.box(7.5, 3.03, .18, 0, 2.17, 4.5, wood);
    for (let z = -4.46; z < 4.5; z += .19) {
      this.box(.055, 3.03, .045, -3.86, 2.17, z, woodWarm);
      this.box(.055, 3.03, .045, 3.86, 2.17, z, woodWarm);
    }
    for (let x = -3.6; x < 3.7; x += .19) this.box(.045, 3.05, .06, x, 2.17, 4.61, woodWarm);

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-3.75, 3.64); gableShape.lineTo(0, 5.84); gableShape.lineTo(3.75, 3.64); gableShape.closePath();
    this.geometry(new THREE.ShapeGeometry(gableShape), 0, 0, 4.59, wood);
    // Insulated pitched roof, standing seams, eaves and a slightly wind-sculpted snow layer.
    const pitch = Math.atan2(2.45, 4.2), slopeLength = Math.hypot(4.2, 2.45);
    for (const side of [-1, 1]) {
      this.box(slopeLength, .2, 10.1, side * 2.1, 4.825, 0, metal, 0, 0, -side * pitch);
      this.box(slopeLength, .07, .13, side * 2.1, 4.79, -5.04, edge, 0, 0, -side * pitch);
      this.box(slopeLength, .07, .13, side * 2.1, 4.79, 5.04, edge, 0, 0, -side * pitch);
      this.box(slopeLength - .12, .055, 9.3, side * 2.03, 4.65, 0, woodWarm, 0, 0, -side * pitch);
      for (let z = -4.8; z < 4.9; z += .47) this.box(slopeLength, .05, .028, side * 2.1, 4.95, z, edge, 0, 0, -side * pitch);
      const roofSnow = new THREE.PlaneGeometry(4.27, 10.15, 28, 45);
      roofSnow.rotateX(-Math.PI / 2);
      const pos = roofSnow.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const x = side * (pos.getX(i) + 2.135), z = pos.getZ(i);
        // The seam tops sit 15.4 cm above the roof plane. Even the thinnest
        // drift must clear them; otherwise black standing seams slice the snow.
        const drift = .29 + .014 * Math.sin(z * .95 + x * 1.4) + .009 * Math.sin(z * 2.3);
        pos.setXYZ(i, x, 6.05 - Math.abs(x) * (2.45 / 4.2) + drift, z);
      }
      if (side < 0) {
        const index = roofSnow.getIndex()!;
        for (let i = 0; i < index.count; i += 3) { const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b); }
      }
      roofSnow.computeVertexNormals();
      const roofMesh = new THREE.Mesh(roofSnow, snow); roofMesh.castShadow = true; roofMesh.receiveShadow = true;
      roofMesh.name = 'Wind-settled roof snow'; this.group.add(roofMesh); this.snowMeshes.push(roofMesh);
      // A rounded snow edge gives the blanket physical depth at the gables.
      for (const z of [-5.073, 5.073]) {
        this.box(slopeLength + .075, .13, .025, side * 2.1, 5.04, z, snow, 0, 0, -side * pitch);
      }
      this.box(.12, .14, 10.12, side * 4.2, 3.59, 0, edge);
    }
    this.box(.16, .08, 10.15, 0, 6.08, 0, metal);

    // Full-height panoramic glazing has actual interior depth and dark, slender mullions.
    for (let i = 0; i < 4; i++) {
      const x = -2.76 + i * 1.84;
      this.box(1.75, 2.84, .024, x, 2.19, -4.57, glass);
    }
    for (const x of [-3.73, -1.84, 0, 1.84, 3.73]) this.box(.07, 3.05, .13, x, 2.16, -4.61, edge);
    this.box(7.55, .09, .14, 0, .72, -4.61, edge);
    this.box(7.55, .09, .14, 0, 3.67, -4.61, edge);
    this.geometry(new THREE.ShapeGeometry(gableShape), 0, 0, -4.58, glass);
    this.box(.075, 2.2, .13, 0, 4.76, -4.62, edge);
    for (const side of [-1, 1]) this.box(Math.hypot(3.75, 2.2), .085, .14, side * 1.875, 4.74, -4.61, edge, 0, 0, -side * Math.atan2(2.2, 3.75));
    // Warm linear soffit lighting is visible without opaque orange window planes.
    this.box(7.12, .025, .035, 0, 3.48, -4.31, lamp);
    this.box(6.85, .022, .035, 0, 3.42, 4.19, lamp);

    // Side entrance with timber jambs, a glazed door, canopy, and compact snow-dusted steps.
    this.box(.21, 2.38, 1.12, 3.87, 1.84, 2.65, edge);
    this.box(.23, 2.18, .92, 3.9, 1.84, 2.65, woodWarm);
    this.box(.02, 1.27, .56, 4.03, 2.04, 2.65, glass);
    this.box(.065, .28, .035, 4.09, 1.67, 2.98, metal);
    this.box(1.55, .11, 1.95, 4.38, 3.22, 2.65, metal);
    this.box(1.49, .08, 1.88, 4.4, 3.32, 2.65, snow);
    for (let i = 0; i < 3; i++) {
      const x = 4.23 + i * .38, top = .62 - i * .185;
      this.box(.42, .28 + top, 1.4, x, (top - .28) / 2, 2.65, stone);
      this.box(.4, .035, 1.36, x, top + .018, 2.65, snow);
    }

    // Deck is a low terrace physically supported on stone piers, with fine parallel planks.
    this.box(8.6, .22, 3.2, .2, .4, -6.05, wood);
    for (const x of [-3.7, 0, 3.9]) for (const z of [-4.7, -7.45]) {
      const ground = heightAt(x, z) - this.constructorHeight;
      this.box(.45, Math.max(.8, .3 - ground), .45, x, (.3 + Math.min(ground, -.5)) / 2, z, stone);
    }
    for (let x = -4.03; x < 4.45; x += .145) this.box(.137, .055, 3.16, x, .535, -6.05, woodWarm);
    for (const x of [-4.04, 4.45]) this.box(.16, .1, 3.25, x, .6, -6.05, snow);
    this.box(8.6, .07, .23, .2, .6, -7.55, snow);
    for (let i = 0; i < 3; i++) {
      this.box(2.1, .2, .4, .3, .37 - i * .17, -7.85 - i * .38, wood);
      this.box(2.04, .025, .35, .3, .48 - i * .17, -7.85 - i * .38, snow);
    }
    // Two woven lounge chairs, joined from thin timber components rather than oversized blocks.
    for (const x of [-2.65, 2.8]) {
      this.box(.64, .1, .66, x, 1.01, -6.37, wood);
      this.box(.61, .57, .09, x, 1.32, -6.07, wood, -.18);
      this.box(.55, .07, .57, x, 1.1, -6.37, upholstery);
      for (const dx of [-.27, .27]) for (const dz of [-.25, .25]) this.box(.055, .46, .055, x + dx, .77, -6.37 + dz, metal);
      for (const dx of [-.35, .35]) this.box(.065, .06, .62, x + dx, 1.28, -6.38, wood);
    }
    this.cylinder(.3, .3, .045, -.9, 1.04, -6.45, woodWarm, 24);
    this.cylinder(.025, .025, .49, -.9, .78, -6.45, metal, 8);

    // Interior: sofa, rug, table, bookshelf, kitchen and a freestanding cast-iron fireplace.
    this.box(2.45, .36, .92, -.9, 1.08, .08, upholstery);
    this.box(2.52, .66, .15, -.9, 1.32, .55, upholstery);
    for (const x of [-2.12, .32]) this.box(.16, .48, 1, x, 1.25, .07, upholstery);
    for (const x of [-1.65, -.88, -.1]) this.box(.72, .12, .73, x, 1.33, .02, upholstery);
    this.box(3.2, .013, 2.75, -.6, .747, -1.3, charcoal);
    this.box(1.3, .09, .65, -.65, 1.12, -1.65, woodWarm);
    for (const x of [-1.18, -.1]) for (const z of [-1.86, -1.43]) this.box(.04, .38, .04, x, .89, z, edge);
    this.box(.27, .035, .19, -.3, 1.18, -1.58, book);
    this.cylinder(.07, .06, .12, -.96, 1.22, -1.66, upholstery, 12);
    this.box(2.9, .83, .67, -1.32, 1.15, 3.87, woodWarm);
    this.box(3.02, .08, .75, -1.32, 1.6, 3.84, stone);
    for (const x of [-2.4, -1.4, -.4]) this.box(.025, .62, .02, x, 1.16, 3.525, edge);
    for (let y = 1.1; y < 3.1; y += .57) {
      this.box(1.18, .045, .32, 2.6, y, 4.1, woodWarm);
      for (let i = 0; i < 7; i++) this.box(.06 + (i % 3) * .02, .23 + (i % 4) * .025, .18, 2.1 + i * .125, y + .17, 4.08, i % 2 ? book : upholstery);
    }
    this.cylinder(.32, .35, .94, 2.55, 1.32, -2.55, charcoal, 24);
    this.box(.46, .44, .055, 2.55, 1.32, -2.86, edge);
    const fireMat = material({ color: 0xff9d43, emissive: 0xff651b, emissiveIntensity: 3.8, roughness: 1 });
    this.fire = new THREE.Mesh(new THREE.PlaneGeometry(.31, .24), fireMat); this.fire.position.set(2.55, 1.32, -2.9); this.fire.rotation.y = Math.PI; this.group.add(this.fire);
    this.cylinder(.085, .085, 3.7, 2.55, 3.62, -2.55, edge, 16);
    // Chimney flashing and cap penetrate the roof rather than hovering above it.
    this.box(.65, .1, .65, 2.55, 4.7, -2.55, metal);
    this.cylinder(.16, .16, 1.4, 2.55, 5.48, -2.55, metal, 16);
    this.cylinder(.25, .25, .05, 2.55, 6.22, -2.55, edge, 16);

    // Log stack: bark cylinders with visible pale cut ends and a sheltered steel cradle.
    this.box(1.85, .06, .54, -2.53, .7, -4.93, edge);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 7 - (row % 2); i++) {
      const x = -3.31 + i * .235 + (row % 2) * .115, y = .82 + row * .205;
      this.cylinder(.112, .09, .47, x, y, -4.92, wood, 9, Math.PI / 2);
      this.cylinder(.095, .088, .013, x, y, -5.163, woodWarm, 9, Math.PI / 2);
    }
    // Ski rack on the side, paired skis and poles with narrow metal bindings.
    this.box(.1, 1.35, 1.6, 4.12, .88, .5, wood);
    this.box(.1, .1, 1.7, 4.3, 1.22, .5, wood);
    for (let i = 0; i < 4; i++) {
      this.box(.12, 1.88, .036, 4.4, 1.17, -.06 + i * .3, i < 2 ? book : edge, .09, 0, -.12);
      this.box(.16, .19, .055, 4.4, 1.05, -.06 + i * .3, metal);
    }
    for (const z of [.1, .42]) this.cylinder(.014, .014, 1.46, 4.67, .98, z, metal, 6, 0, -.1);

    // Ceiling pendants and local illumination spilling out onto the deck snow.
    for (const z of [-2.1, 2]) {
      this.cylinder(.009, .009, 1.36, -.45, 4.48, z, edge, 6);
      this.cylinder(.24, .38, .17, -.45, 3.76, z, metal, 24);
      this.cylinder(.32, .32, .015, -.45, 3.665, z, lamp, 24);
      const l = new THREE.PointLight(0xffb166, 24, 12, 2); l.position.set(-.45, 3.45, z); this.group.add(l); this.lamps.push(l);
    }
    const spill = new THREE.PointLight(0xffb96b, 15, 13, 2); spill.position.set(.5, 1.8, -4.75); this.group.add(spill); this.lamps.push(spill);
    const hearth = new THREE.PointLight(0xff7e2f, 5, 5, 2); hearth.position.set(2.55, 1.35, -2.94); this.group.add(hearth); this.lamps.push(hearth);
    this.flushBatches();

    // Sparse, overlapping wisps have no sphere silhouettes. SpriteNodeMaterial
    // performs camera-facing expansion entirely on the GPU, including instancing.
    this.smokeMaterial = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, color: 0xa4adb4 });
    const smokeUV = uv().sub(.5).mul(2);
    const eddy = mx_noise_float(vec3(uv().mul(3.4), this.smokeTime.mul(.08)));
    const radial = smokeUV.length().add(eddy.mul(.28)).oneMinus().max(0).pow(2.3);
    const density = mx_noise_float(vec3(uv().mul(7), this.smokeTime.mul(.12))).mul(.45).add(.55).clamp(0, 1);
    this.smokeMaterial.opacityNode = radial.mul(density).mul(instancedBufferAttribute(this.smokeDensities)).mul(.075);
    this.smokeMaterial.positionNode = instancedBufferAttribute(this.smokePositions);
    this.smokeMaterial.scaleNode = instancedBufferAttribute(this.smokeScales);
    this.materials.push(this.smokeMaterial);
    const smokeGeometry = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1); smokeGeometry.index = quad.index;
    smokeGeometry.attributes = { ...quad.attributes }; smokeGeometry.instanceCount = 32;
    smokeGeometry.setAttribute('smokePosition', this.smokePositions); smokeGeometry.setAttribute('smokeScale', this.smokeScales); smokeGeometry.setAttribute('smokeDensity', this.smokeDensities);
    this.smoke = new THREE.Mesh(smokeGeometry, this.smokeMaterial);
    this.smoke.frustumCulled = false; this.smoke.name = 'Faint wind-dispersed chimney wisps'; this.smoke.renderOrder = 2; this.group.add(this.smoke);
  }

  private geometry(g: THREE.BufferGeometry, x: number, y: number, z: number, m: THREE.Material, rx = 0, ry = 0, rz = 0) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(matrix);
    // Normalize indexed/non-indexed attributes before merging unlike primitives.
    const baked = g.index ? g.toNonIndexed() : g; if (baked !== g) g.dispose();
    const list = this.batches.get(m) ?? []; list.push(baked); this.batches.set(m, list);
  }
  private box(w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, rx = 0, ry = 0, rz = 0) { this.geometry(new THREE.BoxGeometry(w, h, d), x, y, z, m, rx, ry, rz); }
  private cylinder(rt: number, rb: number, h: number, x: number, y: number, z: number, m: THREE.Material, n = 12, rx = 0, rz = 0) { this.geometry(new THREE.CylinderGeometry(rt, rb, h, n), x, y, z, m, rx, 0, rz); }
  private flushBatches() {
    for (const [material, geometries] of this.batches) {
      const merged = mergeGeometries(geometries, false);
      if (!merged) throw new Error('Cabin geometry merge failed');
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = !material.transparent; mesh.receiveShadow = !material.transparent;
      mesh.name = material.transparent ? 'Panoramic glazing' : 'Architectural assembly';
      this.group.add(mesh); geometries.forEach(g => g.dispose());
    }
    this.batches.clear();
  }

  update(state: EnvironmentState, dt: number, elapsed: number) {
    const sunHeight = Math.sin((state.time - 6) / 24 * Math.PI * 2);
    const night = THREE.MathUtils.smoothstep(-sunHeight, -.15, .23);
    const warm = .4 + night * .6;
    this.lamps.forEach((l, i) => { l.intensity = [24, 24, 15, 5][i] * warm; });
    this.warmSurfaces[0].emissiveIntensity = .035 + night * .08;
    this.warmSurfaces[1].emissiveIntensity = 1.8 + night * 1.6;
    (this.fire.material as THREE.MeshStandardNodeMaterial).emissiveIntensity = 2.5 + .3 * Math.sin(elapsed * 4.1) + .22 * Math.sin(elapsed * 9.3);
    this.snowMeshes.forEach(mesh => { mesh.visible = state.snowCoverage > .12; });
    if (!state.paused) this.smokeClock += dt;
    this.smokeTime.value = this.smokeClock;
    this.smokeMaterial.color.set(0xa4adb4).lerp(new THREE.Color(0x41546a), night * .7);
    const wx = Math.cos(state.windDirection * Math.PI / 180), wz = Math.sin(state.windDirection * Math.PI / 180);
    for (let i = 0; i < 32; i++) {
      const age = (this.smokeClock * .65 + i * .375) % 12;
      const rise = age * .5, spread = .4 + age * .22;
      this.smokePositions.setXYZ(i, 2.55 + wx * age * state.windSpeed * .15 + Math.sin(age * .9) * age * .02, 6.31 + rise, -2.55 + wz * age * state.windSpeed * .15);
      this.smokeScales.setXY(i, spread, spread * 2.05);
      this.smokeDensities.setX(i, (1 - Math.exp(-age * 3)) * Math.pow(1 - age / 12, 2));
    }
    this.smokePositions.needsUpdate = true; this.smokeScales.needsUpdate = true; this.smokeDensities.needsUpdate = true;
  }

  dispose() { this.scene.remove(this.group); this.group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); if (o instanceof THREE.InstancedMesh) o.dispose(); }); this.materials.forEach(m => m.dispose()); }
}
