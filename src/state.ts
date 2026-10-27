// App state: the crush parameters, clicked dents, play mode and the can's
// appearance. The 3D scene subscribes to this outside React's render cycle.
import { create } from 'zustand'
import { DEFAULTS, PRESETS, presetParams, type CrushParams, type Dent } from '@/can/crush.js'
import { METALS, loadImage, type Fit } from '@/can/skin.js'
import caraPils from '@/assets/labels/cara-pils.jpg'

export const PRESET_NAMES = Object.keys(PRESETS)

/**
 * Built-in labels. `src` null is the painted De Klok label; `metal`, when set,
 * is the metal colour the label comes with.
 */
export const LABELS: Record<string, { src: string | null; metal?: string }> = {
  'De Klok': { src: null },
  'Cara Pils': { src: caraPils, metal: '#FAFFFF' },
}
export const YOUR_IMAGE = 'Your image'

export interface Skin {
  label: string
  fit: Fit
  inkMetalness: number
  inkRoughness: number
  metalColor: string
  /** Rotation of the label around the can's axis, in degrees. */
  shift: number
}

interface State {
  params: CrushParams
  /** Name of the loaded preset, or 'custom' once anything was changed. */
  preset: string
  userDents: Dent[]
  dentMode: boolean
  skin: Skin
  customImage: HTMLImageElement | null
  customName: string
  /** Bumped to ask the scene to play the crush animation / re-frame the camera. */
  crushSeq: number
  frameSeq: number
  /** Height of the control panel, so the scene can keep the can above it. */
  panelHeight: number

  setParam: <K extends keyof CrushParams>(key: K, value: CrushParams[K]) => void
  loadPreset: (name: string) => void
  randomize: () => void
  crush: () => void
  setDentMode: (on: boolean) => void
  addDent: (dent: Dent) => void
  clearDents: () => void
  setSkin: (skin: Partial<Skin>) => void
  /** Switches label, and to the label's own metal colour if it has one. */
  chooseLabel: (label: string) => void
  setCustomImage: (image: HTMLImageElement, name: string) => void
  setPanelHeight: (h: number) => void
}

const query = new URLSearchParams(location.search)
const initialPreset = PRESETS[query.get('preset') ?? ''] ? query.get('preset')! : 'flattened'
const metalQuery = query.get('metal')
const fitQuery = query.get('fit') as Fit | null
// blikpletter.be starts with Cara Pils, everywhere else with De Klok
const initialLabel = location.hostname.endsWith('.be') ? 'Cara Pils' : 'De Klok'

export const useCan = create<State>()((set) => ({
  params: presetParams(initialPreset),
  preset: initialPreset,
  userDents: [],
  dentMode: false,
  skin: {
    label: initialLabel,
    fit: fitQuery && ['stretch', 'cover', 'contain'].includes(fitQuery) ? fitQuery : 'stretch',
    inkMetalness: 0,
    inkRoughness: 0.35,
    shift: Number(query.get('shift')) || 0,
    metalColor: (metalQuery && (METALS[metalQuery] ?? metalQuery)) || LABELS[initialLabel].metal || METALS.silver,
  },
  customImage: null,
  customName: 'custom',
  crushSeq: 0,
  frameSeq: 0,
  panelHeight: 0,

  setParam: (key, value) =>
    set((s) => ({
      params: { ...s.params, [key]: value },
      preset: 'custom',
      // changing the pose turns the can over, so frame it again
      frameSeq: key === 'pose' ? s.frameSeq + 1 : s.frameSeq,
    })),
  loadPreset: (name) =>
    set((s) => ({ params: presetParams(name), preset: name, userDents: [], frameSeq: s.frameSeq + 1 })),
  randomize: () =>
    set((s) => ({ params: randomParams(), preset: 'custom', userDents: [], frameSeq: s.frameSeq + 1 })),
  crush: () => set((s) => ({ crushSeq: s.crushSeq + 1 })),
  setDentMode: (dentMode) => set({ dentMode }),
  addDent: (dent) => set((s) => ({ userDents: [...s.userDents, dent] })),
  clearDents: () => set({ userDents: [] }),
  setSkin: (skin) => set((s) => ({ skin: { ...s.skin, ...skin } })),
  chooseLabel: (label) =>
    set((s) => ({ skin: { ...s.skin, label, metalColor: LABELS[label]?.metal ?? s.skin.metalColor } })),
  setCustomImage: (customImage, customName) =>
    set((s) => ({ customImage, customName, skin: { ...s.skin, label: YOUR_IMAGE } })),
  setPanelHeight: (panelHeight) => set({ panelHeight }),
}))

/** Loads an image file as the label (from the upload button or dropped on the page). */
export async function loadLabelFile(file: File | undefined) {
  if (!file?.type.startsWith('image/')) return
  const img = await loadImage(URL.createObjectURL(file))
  useCan.getState().setCustomImage(img, file.name.replace(/\.[^.]+$/, ''))
}

// `?label=<url>` starts with an image label.
const labelQuery = query.get('label')
if (labelQuery) {
  loadImage(labelQuery).then((img) =>
    useCan.getState().setCustomImage(img, labelQuery.split('/').pop()!.replace(/\.[^.]+$/, '')),
  )
}

/** One of four kinds of random crush. */
function randomParams(): CrushParams {
  const r = Math.random
  const pick = (a: number, b: number) => a + (b - a) * r()
  const p: CrushParams = {
    ...DEFAULTS,
    seed: 1 + Math.floor(r() * 100),
    open: true,
    tabAngle: r() < 0.5 ? pick(0, 20) : pick(60, 100),
    crumple: pick(0.3, 1.1),
    creases: Math.round(pick(40, 160)),
    creaseWidth: pick(2.5, 5),
    dents: Math.floor(pick(0, 5)),
    dentDepth: pick(1.5, 4),
  }
  switch (Math.floor(r() * 4)) {
    case 0:
      return { ...p, flatten: pick(0.7, 1), thickness: pick(2.5, 6), flattenAxis: pick(-40, 40), topFold: pick(-40, 40), bottomFold: pick(-30, 30) }
    case 1:
      return { ...p, crush: pick(0.25, 0.6), crushAt: pick(0.2, 0.8), crushFocus: pick(0.2, 0.8), foldSkew: pick(0.2, 1), lobes: Math.round(pick(3, 5)), lean: pick(-8, 8), leanDir: pick(-180, 180) }
    case 2:
      return { ...p, pinch: pick(0.25, 0.6), pinchAt: pick(0.3, 0.7), pinchAngle: pick(-180, 180), twist: pick(-45, 45), bend: pick(-12, 12) }
    default:
      return { ...p, flatten: pick(0.4, 0.8), thickness: pick(6, 12), crush: pick(0.1, 0.35), twist: pick(-25, 25), bend: pick(-10, 10) }
  }
}

/** Short name of the current label, for file names. */
export function canName(s: Pick<State, 'skin' | 'customName'>) {
  if (s.skin.label === 'De Klok') return 'klok'
  const name = s.skin.label === YOUR_IMAGE ? s.customName : s.skin.label.replace(/\(.*\)/, '')
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom'
}
