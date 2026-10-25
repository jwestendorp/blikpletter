// The crush sliders, grouped as they appear in the Adjust tab.
import type { CrushParams } from '@/can/crush.js'

type NumberKey = { [K in keyof CrushParams]: CrushParams[K] extends number ? K : never }[keyof CrushParams]

export interface SliderDef {
  key: NumberKey
  label: string
  min: number
  max: number
  step: number
  unit?: string
}

export interface SliderGroup {
  id: string
  title: string
  sliders: SliderDef[]
}

export const GROUPS: SliderGroup[] = [
  {
    id: 'flatten',
    title: 'Flatten (stepped on its side)',
    sliders: [
      { key: 'flatten', label: 'flatten', min: 0, max: 1, step: 0.01 },
      { key: 'thickness', label: 'thickness', min: 1.5, max: 20, step: 0.1, unit: 'mm' },
      { key: 'flattenAxis', label: 'axis', min: -90, max: 90, step: 1, unit: '°' },
      { key: 'endStiffness', label: 'rim stiffness', min: 0.3, max: 1, step: 0.01 },
      { key: 'topFold', label: 'fold top', min: -90, max: 90, step: 1, unit: '°' },
      { key: 'bottomFold', label: 'fold bottom', min: -90, max: 90, step: 1, unit: '°' },
    ],
  },
  {
    id: 'crush',
    title: 'Crush (stomped from above)',
    sliders: [
      { key: 'crush', label: 'crush', min: 0, max: 0.75, step: 0.01 },
      { key: 'crushAt', label: 'where', min: 0, max: 1, step: 0.01 },
      { key: 'crushFocus', label: 'focus', min: 0, max: 1, step: 0.01 },
      { key: 'foldPitch', label: 'fold size', min: 5, max: 20, step: 0.5, unit: 'mm' },
      { key: 'lobes', label: 'lobes', min: 2, max: 7, step: 1 },
      { key: 'foldSkew', label: 'fold skew', min: 0, max: 1.5, step: 0.01 },
      { key: 'lean', label: 'lean', min: -15, max: 15, step: 0.1, unit: 'mm' },
      { key: 'leanDir', label: 'lean direction', min: -180, max: 180, step: 1, unit: '°' },
    ],
  },
  {
    id: 'squeeze',
    title: 'Squeeze & twist (by hand)',
    sliders: [
      { key: 'pinch', label: 'pinch', min: 0, max: 0.8, step: 0.01 },
      { key: 'pinchAt', label: 'where', min: 0.1, max: 0.9, step: 0.01 },
      { key: 'pinchWidth', label: 'width', min: 8, max: 50, step: 1, unit: 'mm' },
      { key: 'pinchAngle', label: 'direction', min: -180, max: 180, step: 1, unit: '°' },
      { key: 'twist', label: 'twist', min: -90, max: 90, step: 1, unit: '°' },
      { key: 'bend', label: 'bend', min: -45, max: 45, step: 0.5, unit: '°' },
    ],
  },
  {
    id: 'damage',
    title: 'Damage',
    sliders: [
      { key: 'crumple', label: 'crumple', min: 0, max: 1.5, step: 0.01 },
      { key: 'creases', label: 'creases', min: 0, max: 250, step: 1 },
      { key: 'creaseWidth', label: 'crease width', min: 1.5, max: 10, step: 0.1, unit: 'mm' },
      { key: 'dents', label: 'dents', min: 0, max: 12, step: 1 },
      { key: 'dentDepth', label: 'dent depth', min: 0, max: 8, step: 0.1, unit: 'mm' },
      { key: 'seed', label: 'seed', min: 1, max: 100, step: 1 },
    ],
  },
  {
    id: 'lid',
    title: 'Lid',
    sliders: [
      { key: 'tabAngle', label: 'tab', min: 0, max: 110, step: 1, unit: '°' },
      { key: 'flapAngle', label: 'flap', min: 0, max: 90, step: 1, unit: '°' },
    ],
  },
]

/** The group that matters most for each preset, opened when it is loaded. */
export const GROUP_FOR_PRESET: Record<string, string> = {
  stomped: 'crush',
  flattened: 'flatten',
  squeezed: 'squeeze',
  dented: 'damage',
  wrecked: 'flatten',
}

export const formatValue = (v: number, step: number) =>
  step >= 1 ? String(Math.round(v)) : v.toFixed(step >= 0.1 ? 1 : 2)
