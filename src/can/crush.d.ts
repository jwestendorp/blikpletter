// Types for crush.js.
import type * as THREE from 'three'

export type Pose = 'auto' | 'upright' | 'lying'
export interface CrushParams {
  flatten: number; thickness: number; flattenAxis: number; endStiffness: number
  crush: number; crushAt: number; crushFocus: number; foldPitch: number; lobes: number; foldSkew: number
  lean: number; leanDir: number
  pinch: number; pinchAt: number; pinchWidth: number; pinchAngle: number; twist: number
  bend: number; topFold: number; bottomFold: number
  crumple: number; creases: number; creaseWidth: number; dents: number; dentDepth: number
  seed: number
  open: boolean; tabAngle: number; flapAngle: number
  pose: Pose
}
/** A dent in the unrolled label: arc position s and height y, radius r, depth (mm). */
export interface Dent { s: number; y: number; r: number; depth: number }
export const DEFAULTS: CrushParams
export const PRESETS: Record<string, Partial<CrushParams>>
export function presetParams(name: string): CrushParams
export function isLying(params: CrushParams): boolean
export class Crusher {
  constructor(group: THREE.Object3D)
  vertexCount: number
  lastMs: number
  apply(params: CrushParams, userDents?: Dent[]): void
}
