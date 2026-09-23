import type { Metric } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Check, TriangleAlert } from 'lucide-react'

type Props = {
  kind: Metric
  label: string
  value: number
  target: number
  unit: string
  /** Renders the value as the view's hero figure (one per page). */
  hero?: boolean
  className?: string
}

/**
 * A single ratio against a limit, so: a meter, not a chart. The fill is the
 * macro's own hue and the unfilled track is a lighter step of the same ramp,
 * so the state reads across the whole bar rather than only where it stops.
 */
export function MacroMeter({ kind, label, value, target, unit, hero, className }: Props) {
  const ratio = target > 0 ? value / target : 0
  const pct = Math.min(ratio, 1) * 100
  const remaining = target - value
  const over = remaining < 0

  // Overshooting calories is a miss; overshooting protein is a hit. Status
  // colour always ships with an icon + label so it never reads as colour alone.
  const overIsGood = kind === 'protein'
  const status = !over ? null : overIsGood ? 'good' : 'warning'

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {status && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: status === 'good' ? 'var(--status-good)' : 'var(--status-warning)' }}
          >
            {status === 'good' ? (
              <Check className="size-3.5" />
            ) : (
              <TriangleAlert className="size-3.5" />
            )}
            {Math.abs(Math.round(remaining)).toLocaleString()} {unit} over
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'font-semibold tracking-tight text-foreground',
            // Proportional figures: tabular-nums makes big numbers look loose.
            hero ? 'text-5xl' : 'text-2xl',
          )}
        >
          {Math.round(value).toLocaleString()}
        </span>
        <span className={cn('text-muted-foreground', hero ? 'text-base' : 'text-sm')}>
          / {target.toLocaleString()} {unit}
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: `var(--${kind}-track)` }}
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label={`${label}: ${Math.round(value)} of ${target} ${unit}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: `var(--${kind})` }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        {over
          ? `${Math.abs(Math.round(remaining)).toLocaleString()} ${unit} over target`
          : `${Math.round(remaining).toLocaleString()} ${unit} left`}
      </p>
    </div>
  )
}
