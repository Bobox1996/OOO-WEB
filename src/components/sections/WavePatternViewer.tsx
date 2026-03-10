'use client'

import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

export interface WaveParams {
  seed: number
  density: number
  amp1: number
  amp2: number
  amp3: number
  freqX: number
  freqY: number
  freqR: number
  speed1: number
  speed2: number
  speed3: number
  falloff: number
  useFalloff: boolean
  pointSize: number
  renderMode: 'points' | 'lattice' | 'both'
  showVectors: boolean
  vectorLength: number
  logoScale: number
}

export const WAVE_DEFAULTS: WaveParams = {
  seed: 42,
  density: 400,
  amp1: 1.0,
  amp2: 0.5,
  amp3: 0.3,
  freqX: 0.5,
  freqY: 0.5,
  freqR: 0.3,
  speed1: 1.0,
  speed2: 0.8,
  speed3: 0.5,
  falloff: 0.02,
  useFalloff: false,
  pointSize: 0.15,
  renderMode: 'points',
  showVectors: false,
  vectorLength: 0.5,
  logoScale: 1.0,
}

export interface WaveLogoData {
  svgContent: string
  nativeWidth: number
  nativeHeight: number
  nativeMinX: number
  nativeMinY: number
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GRID_EXTENT = 10

function useLogoTexture(logoData: WaveLogoData | null) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    if (!logoData) {
      setTexture(null)
      return
    }

    let disposed = false
    let currentTexture: THREE.CanvasTexture | null = null

    const aspect = logoData.nativeHeight / logoData.nativeWidth
    const canvasW = 256
    const canvasH = Math.round(256 * aspect)
    const canvas = document.createElement('canvas')
    canvas.width = canvasW
    canvas.height = canvasH

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${logoData.nativeMinX} ${logoData.nativeMinY} ${logoData.nativeWidth} ${logoData.nativeHeight}" width="${canvasW}" height="${canvasH}">${logoData.svgContent}</svg>`
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const img = new Image()
    img.onload = () => {
      if (disposed) {
        URL.revokeObjectURL(url)
        return
      }
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvasW, canvasH)
      ctx.drawImage(img, 0, 0, canvasW, canvasH)
      URL.revokeObjectURL(url)

      const tex = new THREE.CanvasTexture(canvas)
      tex.needsUpdate = true
      currentTexture = tex
      setTexture(tex)
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url

    return () => {
      disposed = true
      currentTexture?.dispose()
    }
  }, [logoData?.svgContent, logoData?.nativeWidth, logoData?.nativeHeight, logoData?.nativeMinX, logoData?.nativeMinY])

  return texture
}

function WaveScene({
  params,
  logoData,
}: {
  params: WaveParams
  logoData: WaveLogoData | null
}) {
  const pointsRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const vectorsRef = useRef<THREE.LineSegments>(null)
  const instancedRef = useRef<THREE.InstancedMesh>(null)
  const tempObject = useMemo(() => new THREE.Object3D(), [])

  const logoTexture = useLogoTexture(logoData)
  const hasLogo = logoData !== null && logoTexture !== null

  const cols = Math.max(2, Math.round(Math.sqrt(params.density)))
  const rows = Math.max(2, Math.round(params.density / cols))
  const spacing = (GRID_EXTENT * 2) / Math.max(cols - 1, 1)

  const setup = useMemo(() => {
    const rng = mulberry32(params.seed)
    const total = cols * rows
    const baseX = new Float32Array(total)
    const baseY = new Float32Array(total)
    const jitter = spacing * 0.05

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const idx = j * cols + i
        baseX[idx] = -GRID_EXTENT + i * spacing + (rng() - 0.5) * jitter
        baseY[idx] = -GRID_EXTENT + j * spacing + (rng() - 0.5) * jitter
      }
    }

    const edges: number[] = []
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const idx = j * cols + i
        if (i + 1 < cols) edges.push(idx, idx + 1)
        if (j + 1 < rows) edges.push(idx, idx + cols)
      }
    }

    const pointPos = new Float32Array(total * 3)
    const linePos = new Float32Array(edges.length * 3)
    const vectorPos = new Float32Array(total * 2 * 3)
    const allZ = new Float32Array(total)

    return { baseX, baseY, edges, pointPos, linePos, vectorPos, allZ, total }
  }, [cols, rows, spacing, params.seed])

  const pointsGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(setup.pointPos, 3))
    return geo
  }, [setup])

  const linesGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(setup.linePos, 3))
    return geo
  }, [setup])

  const vectorsGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(setup.vectorPos, 3))
    return geo
  }, [setup])

  const logoPlaneGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])

  const logoMaterial = useMemo(() => {
    if (!logoTexture) return null
    return new THREE.MeshBasicMaterial({
      map: logoTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  }, [logoTexture])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const {
      baseX,
      baseY,
      edges,
      pointPos,
      linePos,
      vectorPos,
      allZ,
      total,
    } = setup
    const {
      amp1,
      amp2,
      amp3,
      freqX,
      freqY,
      freqR,
      speed1,
      speed2,
      speed3,
      falloff,
      useFalloff,
      showVectors,
      vectorLength,
      logoScale,
    } = params

    for (let idx = 0; idx < total; idx++) {
      const x = baseX[idx]
      const y = baseY[idx]
      const r = Math.sqrt(x * x + y * y)
      let z =
        amp1 * Math.sin(freqX * x + t * speed1) +
        amp2 * Math.cos(freqY * y + t * speed2) +
        amp3 * Math.sin(freqR * r - t * speed3)
      if (useFalloff) z *= Math.exp(-falloff * (x * x + y * y))
      allZ[idx] = z
    }

    for (let k = 0; k < total; k++) {
      const o = k * 3
      pointPos[o] = baseX[k]
      pointPos[o + 1] = allZ[k]
      pointPos[o + 2] = baseY[k]
    }

    for (let e = 0; e < edges.length; e += 2) {
      const a = edges[e]
      const b = edges[e + 1]
      const o = e * 3
      linePos[o] = baseX[a]
      linePos[o + 1] = allZ[a]
      linePos[o + 2] = baseY[a]
      linePos[o + 3] = baseX[b]
      linePos[o + 4] = allZ[b]
      linePos[o + 5] = baseY[b]
    }

    if (showVectors) {
      for (let k = 0; k < total; k++) {
        const x = baseX[k]
        const y = baseY[k]
        const z = allZ[k]
        const r = Math.sqrt(x * x + y * y)
        const rSafe = Math.max(r, 0.001)

        let dzdx =
          amp1 * freqX * Math.cos(freqX * x + t * speed1) +
          amp3 * freqR * (x / rSafe) * Math.cos(freqR * r - t * speed3)
        let dzdy =
          -amp2 * freqY * Math.sin(freqY * y + t * speed2) +
          amp3 * freqR * (y / rSafe) * Math.cos(freqR * r - t * speed3)

        if (useFalloff) {
          const f = Math.exp(-falloff * (x * x + y * y))
          const zRaw = f > 0 ? z / f : 0
          dzdx = dzdx * f + zRaw * -2 * falloff * x * f
          dzdy = dzdy * f + zRaw * -2 * falloff * y * f
        }

        const mag = Math.sqrt(dzdx * dzdx + dzdy * dzdy)
        const s = vectorLength / Math.max(mag, 0.001)

        const o = k * 6
        vectorPos[o] = x
        vectorPos[o + 1] = z
        vectorPos[o + 2] = y
        vectorPos[o + 3] = x + dzdx * s
        vectorPos[o + 4] = z
        vectorPos[o + 5] = y + dzdy * s
      }
    }

    if (pointsRef.current)
      pointsRef.current.geometry.attributes.position.needsUpdate = true
    if (linesRef.current)
      linesRef.current.geometry.attributes.position.needsUpdate = true
    if (vectorsRef.current && showVectors)
      vectorsRef.current.geometry.attributes.position.needsUpdate = true

    if (instancedRef.current && hasLogo) {
      const cellSize = spacing * logoScale
      const cameraQuat = state.camera.quaternion
      for (let k = 0; k < total; k++) {
        tempObject.position.set(baseX[k], allZ[k], baseY[k])
        tempObject.quaternion.copy(cameraQuat)
        tempObject.scale.set(cellSize, cellSize, 1)
        tempObject.updateMatrix()
        instancedRef.current.setMatrixAt(k, tempObject.matrix)
      }
      instancedRef.current.instanceMatrix.needsUpdate = true
    }
  })

  const showPoints =
    !hasLogo &&
    (params.renderMode === 'points' || params.renderMode === 'both')
  const showLattice =
    params.renderMode === 'lattice' || params.renderMode === 'both'

  return (
    <>
      {showPoints && (
        <points ref={pointsRef} geometry={pointsGeo}>
          <pointsMaterial
            color="black"
            size={params.pointSize}
            sizeAttenuation
          />
        </points>
      )}
      {showLattice && (
        <lineSegments ref={linesRef} geometry={linesGeo}>
          <lineBasicMaterial color="black" />
        </lineSegments>
      )}
      {params.showVectors && (
        <lineSegments ref={vectorsRef} geometry={vectorsGeo}>
          <lineBasicMaterial color="#cccccc" />
        </lineSegments>
      )}
      {hasLogo && logoMaterial && (
        <instancedMesh
          ref={instancedRef}
          args={[logoPlaneGeo, logoMaterial, setup.total]}
        />
      )}
      <OrbitControls enableDamping dampingFactor={0.05} />
    </>
  )
}

export default function WavePatternViewer({
  params,
  logoData,
}: {
  params: WaveParams
  logoData: WaveLogoData | null
}) {
  return (
    <Canvas
      camera={{ position: [15, 15, 15], fov: 50, near: 0.1, far: 1000 }}
      style={{ background: '#ffffff', width: '100%', height: '100%' }}
    >
      <WaveScene params={params} logoData={logoData} />
    </Canvas>
  )
}
