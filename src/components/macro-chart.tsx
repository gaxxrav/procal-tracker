import type { MacroKind } from '@/components/macro-meter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { shortDateLabel } from '@/lib/format'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type ChartPoint = {
  logged_on: string
  value: number
}

type Props = {
  kind: MacroKind
  title: string
  description: string
  unit: string
  target: number
  data: ChartPoint[]
}

function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
  unit: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{shortDateLabel(point.logged_on)}</p>
      <p className="tabular-nums text-muted-foreground">
        {Math.round(point.value).toLocaleString()} {unit}
      </p>
    </div>
  )
}

/**
 * One macro, one chart. Calories and protein are never plotted on shared axes —
 * a second y-scale would invent a relationship that isn't in the data.
 */
export function MacroChart({ kind, title, description, unit, target, data }: Props) {
  const color = `var(--${kind})`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nothing logged in this range.
          </p>
        ) : (
          // Height covers the plot plus the x-axis band, so the axis labels
          // never get cut off into a nested scroll.
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid
                vertical={false}
                stroke="var(--grid)"
                strokeWidth={1}
                strokeDasharray=""
              />
              <XAxis
                dataKey="logged_on"
                tickFormatter={(key: string) => shortDateLabel(key).slice(0, 6)}
                tickLine={false}
                axisLine={{ stroke: 'var(--axis)' }}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                minTickGap={16}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                width={44}
                tickFormatter={(v: number) => v.toLocaleString()}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
                content={<ChartTooltip unit={unit} />}
              />
              {/* The target is a threshold, not a series — dashed says so. */}
              <ReferenceLine
                y={target}
                stroke="var(--axis)"
                strokeDasharray="4 4"
                label={{
                  value: `target ${target.toLocaleString()}`,
                  position: 'insideTopRight',
                  fill: 'var(--muted-foreground)',
                  fontSize: 10,
                }}
              />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
