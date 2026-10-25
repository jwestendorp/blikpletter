import { Crosshair, Eraser, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { useCan } from '@/state'

const coarse = matchMedia('(pointer: coarse)').matches

export function PlayTab() {
  const crush = useCan((s) => s.crush)
  const dentMode = useCan((s) => s.dentMode)
  const setDentMode = useCan((s) => s.setDentMode)
  const dentCount = useCan((s) => s.userDents.length)
  const clearDents = useCan((s) => s.clearDents)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button size="lg" className="h-14 flex-1 bg-amber-600 text-base font-semibold text-white hover:bg-amber-500" onClick={crush}>
          <Zap className="size-5" />
          Crush!
        </Button>
        <Toggle
          size="lg"
          variant="outline"
          pressed={dentMode}
          onPressedChange={setDentMode}
          className="h-14 px-5 data-[state=on]:border-red-500 data-[state=on]:bg-red-600 data-[state=on]:text-white"
          aria-label="Dent mode"
        >
          <Crosshair className="size-5" />
          Dent
        </Toggle>
      </div>
      <div className="flex min-h-8 items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {dentMode
            ? `${coarse ? 'Tap' : 'Click'} the can to punch a dent.`
            : coarse
              ? 'Crush! plays the current crush. Turn on Dent to punch dents.'
              : 'Crush! plays the current crush. Turn on Dent, or shift+click, to punch dents.'}
        </span>
        {dentCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearDents} className="shrink-0">
            <Eraser />
            Clear {dentCount} {dentCount === 1 ? 'dent' : 'dents'}
          </Button>
        )}
      </div>
    </div>
  )
}
