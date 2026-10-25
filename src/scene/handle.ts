// What the UI needs from the 3D scene without going through React: the root
// group to export, and a place to report how long a deformation took.
import type * as THREE from 'three'

export const sceneHandle: {
  root: THREE.Object3D | null
  onStats: ((text: string) => void) | null
} = { root: null, onStats: null }
