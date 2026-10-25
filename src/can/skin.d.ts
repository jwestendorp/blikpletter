// Types for skin.js.
import type * as THREE from 'three'

export type Fit = 'stretch' | 'cover' | 'contain'
export const METALS: Record<string, string>
export const LABEL_ASPECT: number
export function loadImage(url: string): Promise<HTMLImageElement>
export function composeLabel(
  image: CanvasImageSource,
  opts?: { fit?: Fit; metal?: string; ink?: { metalness?: number; roughness?: number } },
): { colorCanvas: HTMLCanvasElement; mrCanvas: HTMLCanvasElement }
export function setLabel(group: THREE.Object3D, label: { colorCanvas: HTMLCanvasElement; mrCanvas: HTMLCanvasElement }): void
export function restoreDefaultLabel(group: THREE.Object3D): void
export function setLabelShift(group: THREE.Object3D, degrees: number): void
export function setMetalColor(group: THREE.Object3D, hex: string): void
export function labelTemplate(width?: number): HTMLCanvasElement
