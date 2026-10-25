import { useState } from 'react'
import { Dices, RotateCcw } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { Pose } from '@/can/crush.js'
import { GROUPS, GROUP_FOR_PRESET } from '@/sliders'
import { PRESET_NAMES, useCan } from '@/state'
import { ParamSlider } from './ParamSlider'

const title = (name: string) => name[0].toUpperCase() + name.slice(1)

export function AdjustTab() {
  const params = useCan((s) => s.params)
  const preset = useCan((s) => s.preset)
  const setParam = useCan((s) => s.setParam)
  const loadPreset = useCan((s) => s.loadPreset)
  const randomize = useCan((s) => s.randomize)

  // Open the slider group that matters for a freshly loaded preset.
  const [open, setOpen] = useState<string[]>(() => [GROUP_FOR_PRESET[preset] ?? 'crush'])
  const [openFor, setOpenFor] = useState(preset)
  if (preset !== openFor) {
    setOpenFor(preset)
    if (GROUP_FOR_PRESET[preset]) setOpen([GROUP_FOR_PRESET[preset]])
  }

  return (
    <div className="flex flex-col">
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 flex gap-2 bg-popover px-4 pt-4 pb-3">
        <Select value={preset === 'custom' ? '' : preset} onValueChange={loadPreset}>
          <SelectTrigger className="min-w-0 flex-1" aria-label="Load preset">
            <SelectValue placeholder={preset === 'custom' ? 'Custom · load preset' : 'Load preset'} />
          </SelectTrigger>
          <SelectContent>
            {PRESET_NAMES.map((name) => (
              <SelectItem key={name} value={name}>
                {title(name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={randomize} aria-label="Randomize">
          <Dices />
          <span className="max-sm:sr-only">Randomize</span>
        </Button>
        <Button variant="secondary" onClick={() => loadPreset('intact')} aria-label="Reset">
          <RotateCcw />
          <span className="max-sm:sr-only">Reset</span>
        </Button>
      </div>

      <Accordion type="multiple" value={open} onValueChange={setOpen}>
        {GROUPS.map((group) => (
          <AccordionItem key={group.id} value={group.id}>
            <AccordionTrigger className="py-3">{group.title}</AccordionTrigger>
            <AccordionContent>
              {group.id === 'lid' && (
                <div className="flex items-center justify-between py-1.5">
                  <Label htmlFor="lid-open" className="font-normal text-muted-foreground">
                    opened
                  </Label>
                  <Switch id="lid-open" checked={params.open} onCheckedChange={(v) => setParam('open', v)} />
                </div>
              )}
              {group.sliders.map((s) => (
                <ParamSlider
                  key={s.key}
                  id={`p-${s.key}`}
                  label={s.label}
                  value={params[s.key]}
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  unit={s.unit}
                  onChange={(v) => setParam(s.key, v)}
                />
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
        <AccordionItem value="pose">
          <AccordionTrigger className="py-3">Pose</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3 py-1.5">
              <Label className="font-normal text-muted-foreground">resting on</Label>
              <Select value={params.pose} onValueChange={(v) => setParam('pose', v as Pose)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">auto (lying when flattened)</SelectItem>
                  <SelectItem value="upright">its bottom</SelectItem>
                  <SelectItem value="lying">its side</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
