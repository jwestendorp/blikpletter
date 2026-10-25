import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { buildCan } from '@/can/can.js'
import { Crusher, DEFAULTS, isLying, type CrushParams } from '@/can/crush.js'
import { C, BODY_BOTTOM, LABEL_H } from '@/can/label.js'
import { composeLabel, restoreDefaultLabel, setLabel, setLabelShift, setMetalColor, loadImage } from '@/can/skin.js'
import { LABELS, useCan } from '@/state'
import { sceneHandle } from './handle'

interface Built {
  group: THREE.Group
  crusher: Crusher
  body: THREE.Mesh
}

// Parameters that animate from intact to their target when the can is crushed.
const LERPED = ['flatten', 'crush', 'lean', 'pinch', 'twist', 'bend', 'topFold', 'bottomFold',
  'crumple', 'dentDepth', 'tabAngle', 'flapAngle'] as const
const CRUSH_MS = 1600
const DEG = Math.PI / 180

export function CanModel() {
  const [built, setBuilt] = useState<Built | null>(null)
  // root (placed on the ground) → pivot (lying / upright) → spin (flatten axis) → can
  const root = useRef<THREE.Group>(null!)
  const pivot = useRef<THREE.Group>(null!)
  const spin = useRef<THREE.Group>(null!)
  const dirty = useRef(true)
  const animation = useRef<{ start: number; target: CrushParams } | null>(null)
  const needsFrame = useRef(true)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    let alive = true
    buildCan({ crushable: true }).then(({ group }) => {
      if (!alive) return
      group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true
      })
      setBuilt({ group, crusher: new Crusher(group), body: group.getObjectByName('body') as THREE.Mesh })
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    sceneHandle.root = built ? root.current : null
  }, [built])

  // --- deformation ---------------------------------------------------------------
  function placeOnGround(p: CrushParams) {
    const lying = isLying(p)
    pivot.current.rotation.set(lying ? -Math.PI / 2 : 0, 0, 0)
    spin.current.rotation.set(0, lying ? -p.flattenAxis * DEG : 0, 0)
    root.current.position.set(0, 0, 0)
    root.current.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root.current, true)
    const c = box.getCenter(new THREE.Vector3())
    root.current.position.set(-c.x, -box.min.y, -c.z)
    root.current.updateMatrixWorld(true)
    return box.getSize(new THREE.Vector3())
  }

  function deform(p: CrushParams) {
    if (!built) return
    built.crusher.apply(p, useCan.getState().userDents)
    placeOnGround(p)
    sceneHandle.onStats?.(
      `${built.crusher.vertexCount.toLocaleString()} vertices · deformed in ${built.crusher.lastMs.toFixed(0)} ms`,
    )
  }

  // Store changes mark the can dirty; the frame loop deforms at most once a frame.
  useEffect(
    () =>
      useCan.subscribe((s, prev) => {
        if (s.params !== prev.params || s.userDents !== prev.userDents) dirty.current = true
        if (s.frameSeq !== prev.frameSeq) needsFrame.current = true
        if (s.crushSeq !== prev.crushSeq) {
          animation.current = {
            start: performance.now(),
            target: { ...s.params, pose: isLying(s.params) ? 'lying' : 'upright' },
          }
        }
      }),
    [],
  )

  // --- camera framing ------------------------------------------------------------
  // The free part of the canvas is above the control panel; keep the can centred there.
  function freeHeight() {
    return Math.max(80, size.height - useCan.getState().panelHeight)
  }
  function fitView() {
    const dy = size.height / 2 - freeHeight() / 2
    camera.aspect = size.width / size.height
    if (dy > 0) camera.setViewOffset(size.width, size.height, 0, dy, size.width, size.height)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }
  // Distance along `dir` at which every corner of the can's box fits the free area.
  function fitDistance(dir: THREE.Vector3, target: THREE.Vector3) {
    const t = Math.tan((camera.fov * DEG) / 2) * 0.9
    const tanV = (t * freeHeight()) / size.height
    const tanH = (t * size.width) / size.height
    const right = new THREE.Vector3().crossVectors(camera.up, dir).normalize()
    const up = new THREE.Vector3().crossVectors(dir, right)
    const box = new THREE.Box3().setFromObject(root.current)
    const c = new THREE.Vector3()
    let d = 0
    for (let i = 0; i < 8; i++) {
      c.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(target)
      const z = c.dot(dir)
      d = Math.max(d, z + Math.abs(c.dot(right)) / tanH, z + Math.abs(c.dot(up)) / tanV)
    }
    return d
  }
  function frameCamera() {
    const p = useCan.getState().params
    const lying = isLying(p)
    const az = (lying ? 30 : 25) * DEG
    const el = (lying ? 48 : 18) * DEG
    const size3 = placeOnGround(p)
    const target = new THREE.Vector3(0, size3.y / 2, 0)
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
    fitView()
    camera.position.copy(target).addScaledVector(dir, fitDistance(dir, target))
    controls?.target.copy(target)
    controls?.update()
  }
  // Re-fit, keeping the viewing direction, when the panel or the window changes size.
  useEffect(() => {
    const refit = () => {
      if (!built || !controls) return
      fitView()
      const dir = camera.position.clone().sub(controls.target).normalize()
      camera.position.copy(controls.target).addScaledVector(dir, fitDistance(dir, controls.target))
    }
    refit()
    return useCan.subscribe((s, prev) => {
      if (s.panelHeight !== prev.panelHeight) refit()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, controls, size.width, size.height])

  useFrame(() => {
    if (!built) return
    const anim = animation.current
    if (anim) {
      const t = Math.min(1, (performance.now() - anim.start) / CRUSH_MS)
      const e = 1 - (1 - t) ** 3
      const p = { ...anim.target }
      for (const k of LERPED) p[k] = DEFAULTS[k] + (anim.target[k] - DEFAULTS[k]) * e
      // the tab gets pulled first, then the can is crushed
      p.tabAngle = anim.target.tabAngle * Math.min(1, t * 4)
      p.flapAngle = anim.target.flapAngle * Math.min(1, t * 4)
      deform(p)
      if (t >= 1) {
        animation.current = null
        dirty.current = true
      }
    } else if (dirty.current) {
      dirty.current = false
      deform(useCan.getState().params)
    }
    if (needsFrame.current && controls) {
      needsFrame.current = false
      frameCamera()
    }
  })

  // --- appearance ------------------------------------------------------------------
  const { label, fit, metalColor, inkMetalness, inkRoughness, shift } = useCan((s) => s.skin)
  const customImage = useCan((s) => s.customImage)
  const images = useRef(new Map<string, HTMLImageElement>())
  // the shift is read when a new label goes on, without recomposing for it
  const shiftRef = useRef(shift)
  useEffect(() => {
    shiftRef.current = shift
    if (built) setLabelShift(built.group, shift)
  }, [built, shift])
  useEffect(() => {
    if (!built) return
    let current = true
    setMetalColor(built.group, metalColor)
    const src = label in LABELS ? LABELS[label].src : customImage
    if (!src) {
      restoreDefaultLabel(built.group)
      setLabelShift(built.group, shiftRef.current)
      return
    }
    // Composing a label takes a moment, so wait until the colour picker or a
    // slider has settled.
    const timer = setTimeout(async () => {
      let img = typeof src === 'string' ? images.current.get(src) : src
      if (!img && typeof src === 'string') {
        img = await loadImage(src)
        images.current.set(src, img)
      }
      if (!current || !img) return
      setLabel(built.group, composeLabel(img, {
        fit,
        metal: metalColor,
        ink: { metalness: inkMetalness, roughness: inkRoughness },
      }))
      setLabelShift(built.group, shiftRef.current)
    }, 120)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [built, label, fit, metalColor, inkMetalness, inkRoughness, customImage])

  // --- dents: a tap that doesn't drag, in dent mode or with shift held -------------
  useEffect(() => {
    if (!built) return
    const el = gl.domElement
    const raycaster = new THREE.Raycaster()
    const taps = new Map<number, { x: number; y: number; t: number; shift: boolean; cancelled?: boolean }>()
    const down = (ev: PointerEvent) => {
      taps.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, t: performance.now(), shift: ev.shiftKey })
      // a second finger means pinch or pan, never a tap
      if (taps.size > 1) for (const tap of taps.values()) tap.cancelled = true
    }
    const up = (ev: PointerEvent) => {
      const tap = taps.get(ev.pointerId)
      taps.delete(ev.pointerId)
      const { dentMode, addDent, params } = useCan.getState()
      if (!tap || tap.cancelled || !(dentMode || tap.shift)) return
      if (Math.hypot(ev.clientX - tap.x, ev.clientY - tap.y) > 10 || performance.now() - tap.t > 500) return
      const rect = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObject(built.body)[0]
      if (!hit?.uv) return
      addDent({
        s: (hit.uv.x - 0.5) * C,
        y: BODY_BOTTOM + hit.uv.y * LABEL_H,
        r: 9,
        depth: Math.max(2.5, params.dentDepth + 1),
      })
      navigator.vibrate?.(15)
    }
    const cancel = (ev: PointerEvent) => taps.delete(ev.pointerId)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
    }
  }, [built, gl, camera])

  return (
    <group ref={root} name="DeKlokBierCan50cl_crushed">
      <group ref={pivot}>
        <group ref={spin}>{built && <primitive object={built.group} />}</group>
      </group>
    </group>
  )
}
