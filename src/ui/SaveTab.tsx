import { useRef, useState } from 'react'
import { Download, FileImage, Upload } from 'lucide-react'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { METALS, labelTemplate, type Fit } from '@/can/skin.js'
import { sceneHandle } from '@/scene/handle'
import { LABELS, YOUR_IMAGE, canName, loadLabelFile, useCan } from '@/state'
import { cn } from '@/lib/utils'
import { ParamSlider } from './ParamSlider'

function download(href: string, name: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.click()
}

export function SaveTab() {
  const skin = useCan((s) => s.skin)
  const setSkin = useCan((s) => s.setSkin)
  const chooseLabel = useCan((s) => s.chooseLabel)
  const hasCustom = useCan((s) => s.customImage !== null)
  const fileName = useCan((s) => `${canName(s)}-can-${s.preset}.glb`)
  const fileInput = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  // ink sliders apply on release; composing a 4k label is too slow to do live
  const [ink, setInk] = useState({ metalness: skin.inkMetalness, roughness: skin.inkRoughness })
  const custom = skin.label !== 'De Klok'
  const labelNames = [...Object.keys(LABELS), ...(hasCustom ? [YOUR_IMAGE] : [])]

  async function save() {
    if (!sceneHandle.root) return
    setSaving(true)
    await new Promise((r) => setTimeout(r, 30)) // let "Saving…" paint first
    try {
      const glb = (await new GLTFExporter().parseAsync(sceneHandle.root, { binary: true })) as ArrayBuffer
      download(URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' })), fileName)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Button size="lg" className="h-12 text-base font-semibold" onClick={save} disabled={saving}>
          <Download className="size-5" />
          {saving ? 'Saving…' : 'Save 3D model (GLB)'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{fileName}</p>
      </div>

      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Label</h3>
        <div className="flex gap-2">
          <Select value={skin.label} onValueChange={chooseLabel}>
            <SelectTrigger className="min-w-0 flex-1" aria-label="Label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {labelNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            <Upload />
            Upload image
          </Button>
          <Input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              loadLabelFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          An image wraps once around the can, with its middle on the front. Transparent parts show bare metal.
        </p>
        <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
          <Label className="font-normal text-muted-foreground">image fit</Label>
          <Select value={skin.fit} onValueChange={(fit) => setSkin({ fit: fit as Fit })} disabled={!custom}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stretch">stretch around the can</SelectItem>
              <SelectItem value="cover">cover (crop the excess)</SelectItem>
              <SelectItem value="contain">contain (metal around it)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <ParamSlider
            id="ink-metalness"
            label="ink metalness"
            value={ink.metalness}
            min={0}
            max={1}
            step={0.01}
            disabled={!custom}
            onChange={(metalness) => setInk((i) => ({ ...i, metalness }))}
            onCommit={(inkMetalness) => setSkin({ inkMetalness })}
          />
          <ParamSlider
            id="ink-roughness"
            label="ink roughness"
            value={ink.roughness}
            min={0.05}
            max={0.9}
            step={0.01}
            disabled={!custom}
            onChange={(roughness) => setInk((i) => ({ ...i, roughness }))}
            onCommit={(inkRoughness) => setSkin({ inkRoughness })}
          />
        </div>
        <ParamSlider
          id="texture-shift"
          label="texture shift"
          value={skin.shift}
          min={-180}
          max={180}
          step={1}
          unit="°"
          onChange={(shift) => setSkin({ shift })}
        />
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => download(labelTemplate().toDataURL('image/png'), 'can-label-template.png')}
        >
          <FileImage />
          Download label template
        </Button>
      </section>

      <Separator />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Metal</h3>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(METALS).map(([name, hex]) => (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={skin.metalColor === hex}
              onClick={() => setSkin({ metalColor: hex })}
              className={cn(
                'size-9 cursor-pointer rounded-full border-2 border-transparent shadow-inner ring-offset-2 ring-offset-popover transition',
                skin.metalColor === hex && 'ring-2 ring-ring',
              )}
              style={{ background: `radial-gradient(circle at 35% 30%, #fff8, ${hex} 55%)` }}
            />
          ))}
          <label
            className={cn(
              'relative size-9 cursor-pointer overflow-hidden rounded-full border border-dashed border-muted-foreground',
              !Object.values(METALS).includes(skin.metalColor) && 'ring-2 ring-ring ring-offset-2 ring-offset-popover',
            )}
            title="any colour"
            style={{ background: Object.values(METALS).includes(skin.metalColor) ? undefined : skin.metalColor }}
          >
            <span className="sr-only">Pick any colour</span>
            <input
              type="color"
              value={skin.metalColor}
              onChange={(e) => setSkin({ metalColor: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Rims, lid, tab and the unprinted parts of the label.</p>
      </section>
    </div>
  )
}
