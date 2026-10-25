import { useEffect, useRef, useState } from 'react'
import { Download, Play, SlidersHorizontal } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCan } from '@/state'
import { AdjustTab } from './AdjustTab'
import { PlayTab } from './PlayTab'
import { SaveTab } from './SaveTab'

const TABS = [
  { value: 'play', label: 'Play', icon: Play },
  { value: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
  { value: 'save', label: 'Save', icon: Download },
] as const

// The bottom panel: tab content above, the three tabs along the bottom edge.
export function Panel() {
  const [tab, setTab] = useState<string>('play')
  const ref = useRef<HTMLDivElement>(null)
  const setPanelHeight = useCan((s) => s.setPanelHeight)

  // Tell the scene how much of the screen the panel covers.
  useEffect(() => {
    const el = ref.current!
    const ro = new ResizeObserver(() => setPanelHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [setPanelHeight])

  return (
    <div
      ref={ref}
      className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-xl overflow-hidden rounded-t-2xl border border-b-0 bg-popover text-popover-foreground shadow-2xl sm:bottom-3 sm:rounded-2xl sm:border-b"
    >
      <Tabs value={tab} onValueChange={setTab} className="gap-0">
        <div className="max-h-[min(40dvh,25rem)] overflow-y-auto overscroll-contain px-4 pt-4 pb-3">
          <TabsContent value="play">
            <PlayTab />
          </TabsContent>
          <TabsContent value="adjust">
            <AdjustTab />
          </TabsContent>
          <TabsContent value="save">
            <SaveTab />
          </TabsContent>
        </div>
        <TabsList
          variant="line"
          className="grid w-full grid-cols-3 gap-0 border-t px-2 pt-0 pb-[env(safe-area-inset-bottom)] group-data-horizontal/tabs:h-auto"
        >
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-11 gap-1.5 text-sm group-data-horizontal/tabs:after:top-[-1px] group-data-horizontal/tabs:after:bottom-auto"
            >
              <Icon className="size-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
