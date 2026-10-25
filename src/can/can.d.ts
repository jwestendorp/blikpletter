// Types for can.js.
import type * as THREE from 'three'

export function buildCan(opts?: { crushable?: boolean }): Promise<{ group: THREE.Group }>
