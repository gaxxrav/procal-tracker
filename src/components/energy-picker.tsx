import { ENERGY_LABELS, ENERGY_LEVELS } from '@/lib/types'
import { cn } from '@/lib/utils'

type Props = {
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
}

/**
 * Energy/fatigue for the whole day. Optional — clicking the selected level
 * again clears it, so "didn't say" stays distinct from "said 3".
 */
export function EnergyPicker({ value, onChange, disabled }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Energy today</span>
        <span className="text-xs text-muted-foreground">
          {value ? ENERGY_LABELS[value] : 'Not set'}
        </span>
      </div>

      <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Energy level">
        {ENERGY_LEVELS.map((level) => {
          const active = value === level
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${level} — ${ENERGY_LABELS[level]}`}
              disabled={disabled}
              onClick={() => onChange(active ? null : level)}
              className={cn(
                'h-9 flex-1 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50',
                active
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {level}
            </button>
          )
        })}
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        1 = {ENERGY_LABELS[1].toLowerCase()}, 5 = {ENERGY_LABELS[5].toLowerCase()}
      </p>
    </div>
  )
}
