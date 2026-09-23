import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { shortDateLabel } from '@/lib/format'
import type { Metric } from '@/lib/types'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
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
  metric: Metric
  title: string
  description: string
  unit: string
  /** Drawn as a dashed threshold line. Omit when there is no target. */
  target?: number
  kind?: 'bar' | 'line'
  data: ChartPoint[]
  emptyLabel?: string
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
 * One metric, one chart. Two measures are never plotted on shared axes — a
 * second y-scale would invent a relationship that isn't in the data.
 */
export function MetricChart({
  metric,
  title,
  description,
  unit,
  target,
  kind = 'bar',
  data,
  emptyLabel = 'Nothing logged in this range.',
}: Props) {
  const color = `var(--${metric})`
  const Chart = kind === 'line' ? ComposedChart : BarChart

  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} strokeDasharray="" />
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
        // A weight axis starting at zero wastes the whole plot, so let it fit
        // the data; counts and volumes stay anchored at zero.
        domain={kind === 'line' ? ['dataMin - 1', 'dataMax + 1'] : [0, 'auto']}
        tickFormatter={(v: number) => Math.round(v).toLocaleString()}
        allowDecimals={false}
      />
      <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip unit={unit} />} />
      {target !== undefined && (
        // A target is a threshold, not a series — dashed says so.
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
      )}
    </>
  )

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
          <p className="py-12 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          // Height covers the plot plus the x-axis band, so axis labels never
          // get cut into a nested scroll.
          <ResponsiveContainer width="100%" height={220}>
            <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              {axes}
              {kind === 'line' ? (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  // 2px surface ring keeps dots legible where they overlap.
                  dot={{ r: 4, fill: color, stroke: 'var(--card)', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: color, stroke: 'var(--card)', strokeWidth: 2 }}
                  connectNulls
                />
              ) : (
                <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} />
              )}
            </Chart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
