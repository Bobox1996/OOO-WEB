import { MathUtils, type Vector3 } from 'three'
import type { Point } from './world'

/** A rail inside the rear wall swings to the side as the visitor comes back to the door. */
export function placeHomeWalkCamera(eye: Vector3, aim: Vector3, player: Point, portrait: boolean, high: boolean) {
  const { x, z } = player
  const rear = MathUtils.smoothstep(z, .45, 2.95)
  const rearEyeX = -4.67 + Math.max(0, x + 2.55) * .53
  const eyeX = MathUtils.lerp(.58 * x - .42, rearEyeX, rear)
  const eyeZ = Math.min(4.03, z + (high ? 5.1 : 4.45))
  const distance = Math.hypot(x - eyeX, z - eyeZ)
  const close = 1 - MathUtils.smoothstep(distance, .95, 2.90)
  eye.set(eyeX, high ? 2.92 : 2.10 + .28 * rear + .29 * close, eyeZ)
  const aimHeight = high ? .80 : MathUtils.lerp(portrait ? 1.15 : 1.35, .97, close)
  aim.set(x, aimHeight, z - Math.min(.48, distance * .09))
  return (portrait ? 64 : 54) + (high ? 5 : 0) + 11 * close
}
