import { MacroChart, type ChartPoint } from '@/components/macro-chart'
import { StatTile } from '@/components/stat-tile'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { listDailyTotals } from '@/lib/api'
import { toDateKey } from '@/lib/format'
import type { DailyTotals } from '@/lib/types'
import { cn } from '@/lib/utils'
import { subDays } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const

export function StatsPage() {
  const { user, profile } = useAuth()
  const [range, setRange] = useState<number>(30)
  const [rows, setRows] = useState<DailyTotals[]>([])
  const [loading, setLoading] = useState(true)

  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    const to = toDateKey(new Date())
    const from = toDateKey(subDays(new Date(), range - 1))
    listDailyTotals(userId, from, to)
      .then(setRows)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : 'Could not load stats'),
      )
      .finally(() => setLoading(false))
  }, [userId, range])

  const calorieTarget = profile?.calorie_target ?? 2400
  const proteinTarget = profile?.protein_target ?? 140

  const calorieData = useMemo<ChartPoint[]>(
    () => rows.map((r) => ({ logged_on: r.logged_on, value: Number(r.calories) })),
    [rows],
  )
  const proteinData = useMemo<ChartPoint[]>(
    () => rows.map((r) => ({ logged_on: r.logged_on, value: Number(r.protein) })),
    [rows],
  )

  const summary = useMemo(() => {
    if (rows.length === 0) {
      return { avgCalories: 0, avgProtein: 0, calorieDays: 0, proteinDays: 0 }
    }
    let calories = 0
    let protein = 0
    let calorieDays = 0
    let proteinDays = 0
    for (const row of rows) {
      const c = Number(row.calories)
      const p = Number(row.protein)
      calories += c
      protein += p
      if (c <= calorieTarget) calorieDays += 1
      if (p >= proteinTarget) proteinDays += 1
    }
    return {
      avgCalories: Math.round(calories / rows.length),
      avgProtein: Math.round(protein / rows.length),
      calorieDays,
      proteinDays,
    }
  }, [rows, calorieTarget, proteinTarget])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Stats</h1>
        {/* One filter row above everything it scopes — both charts and the
            tiles re-render against the same slice. */}
        <div className="flex gap-1">
          {RANGES.map(({ days, label }) => (
            <Button
              key={days}
              variant="ghost"
              size="sm"
              aria-pressed={range === days}
              className={cn(range === days && 'bg-muted text-foreground')}
              onClick={() => setRange(days)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nothing logged in the last {range} days.{' '}
          <Link to="/" className="font-medium text-foreground underline underline-offset-4">
            Log something
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              kind="calories"
              label="Avg calories"
              value={summary.avgCalories.toLocaleString()}
              detail={`target ${calorieTarget.toLocaleString()}`}
            />
            <StatTile
              kind="protein"
              label="Avg protein"
              value={`${summary.avgProtein}g`}
              detail={`target ${proteinTarget}g`}
            />
            <StatTile
              label="Days under calories"
              value={`${summary.calorieDays}/${rows.length}`}
              detail="days logged in range"
            />
            <StatTile
              label="Days hitting protein"
              value={`${summary.proteinDays}/${rows.length}`}
              detail="days logged in range"
            />
          </div>

          <MacroChart
            kind="calories"
            title="Calories per day"
            description={`Last ${range} days, against a ${calorieTarget.toLocaleString()} kcal target.`}
            unit="kcal"
            target={calorieTarget}
            data={calorieData}
          />

          <MacroChart
            kind="protein"
            title="Protein per day"
            description={`Last ${range} days, against a ${proteinTarget}g target.`}
            unit="g"
            target={proteinTarget}
            data={proteinData}
          />

          <p className="text-center text-xs text-muted-foreground">
            Every value here is also in{' '}
            <Link to="/history" className="underline underline-offset-4">
              History
            </Link>{' '}
            as a table.
          </p>
        </>
      )}
    </div>
  )
}
