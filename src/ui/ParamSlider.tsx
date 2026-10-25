import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { formatValue } from '@/sliders'

interface Props {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  disabled?: boolean
  onChange: (value: number) => void
  /** Called once the thumb is released (for changes too slow to apply live). */
  onCommit?: (value: number) => void
}

export function ParamSlider({ id, label, value, min, max, step, unit, disabled, onChange, onCommit }: Props) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 py-1.5">
      <Label htmlFor={id} className="truncate text-sm font-normal text-muted-foreground">
        {label}
      </Label>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={onCommit && (([v]) => onCommit(v))}
      />
      <span className="text-right font-mono text-xs tabular-nums text-foreground">
        {formatValue(value, step)}
        {unit && <span className="text-muted-foreground">{unit === '°' ? '°' : ` ${unit}`}</span>}
      </span>
    </div>
  )
}
