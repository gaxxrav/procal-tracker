import { Card, CardContent } from '@/components/ui/card'
import type { MacroKind } from '@/components/macro-meter'

type Props = {
  label: string
  value: string
  detail?: string
  /** Shows a small colour key so the tile ties back to its chart. */
  kind?: MacroKind
}

export function StatTile({ label, value, detail, kind }: Props) {
  return (
    <Card>
      <CardContent className="space-y-1 px-4">
        <div className="flex items-center gap-1.5">
          {kind && (
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: `var(--${kind})` }}
            />
          )}
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        {/* Proportional figures — tabular-nums reads loose at this size. */}
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  )
}
