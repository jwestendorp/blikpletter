import { useEffect, useRef, useState } from 'react'
import { Scene } from '@/scene/Scene'
import { sceneHandle } from '@/scene/handle'
import { Panel } from '@/ui/Panel'
import { loadLabelFile } from '@/state'

const coarse = matchMedia('(pointer: coarse)').matches

export default function App() {
  const stats = useRef<HTMLSpanElement>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    sceneHandle.onStats = (text) => {
      if (stats.current) stats.current.textContent = text
    }
    return () => {
      sceneHandle.onStats = null
    }
  }, [])

  // Drop an image anywhere on the page to wrap it around the can.
  useEffect(() => {
    const hasImage = (ev: DragEvent) => [...(ev.dataTransfer?.items ?? [])].some((i) => i.type.startsWith('image/'))
    const over = (ev: DragEvent) => {
      if (!hasImage(ev)) return
      ev.preventDefault()
      setDragging(true)
    }
    const leave = (ev: DragEvent) => {
      if (!ev.relatedTarget) setDragging(false)
    }
    const drop = (ev: DragEvent) => {
      setDragging(false)
      const file = [...(ev.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (!file) return
      ev.preventDefault()
      loadLabelFile(file)
    }
    addEventListener('dragover', over)
    addEventListener('dragleave', leave)
    addEventListener('drop', drop)
    return () => {
      removeEventListener('dragover', over)
      removeEventListener('dragleave', leave)
      removeEventListener('drop', drop)
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-[radial-gradient(#f4f2ee,#cfcac2)]">
      <Scene />
      <header className="pointer-events-none absolute top-[calc(0.75rem+env(safe-area-inset-top))] left-[calc(0.875rem+env(safe-area-inset-left))] flex flex-col text-stone-500">
        <h1 className="font-heading text-lg font-semibold tracking-tight text-stone-700">Blikpletter</h1>
        <span className="text-xs">{coarse ? 'drag to orbit · pinch to zoom' : 'drag to orbit · scroll to zoom'}</span>
        <span ref={stats} className="text-[11px] text-stone-400" />
      </header>
      <Panel />
      {dragging && (
        <div className="pointer-events-none fixed inset-3 z-20 flex items-center justify-center rounded-2xl border-4 border-dashed border-green-600 bg-stone-100/85 text-lg font-semibold text-green-800">
          Drop an image to wrap it around the can
        </div>
      )}
    </div>
  )
}
