import { MetricChart, type ChartPoint } from '@/components/metric-chart'
import { StatTile } from '@/components/stat-tile'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { listDailyLogs, listDailyTotals, listDailyWorkoutTotals } from '@/lib/api'
import { round, toDateKey } from '@/lib/format'
import type { DailyLog, DailyTotals, DailyWorkoutTotals } from '@/lib/types'
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
  const [food, setFood] = useState<DailyTotals[]>([])
  const [workouts, setWorkouts] = useState<DailyWorkoutTotals[]>([])
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)

  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    const to = toDateKey(new Date())
    const from = toDateKey(subDays(new Date(), range - 1))
    Promise.all([
      listDailyTotals(userId, from, to),
      listDailyWorkoutTotals(userId, from, to),
      listDailyLogs(userId, from, to),
    ])
      .then(([f, w, l]) => {
        setFood(f)
        setWorkouts(w)
        setLogs(l)
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : 'Could not load stats'),
      )
      .finally(() => setLoading(false))
  }, [userId, range])

  const calorieTarget = profile?.calorie_target ?? 2400
  const proteinTarget = profile?.protein_target ?? 140

  // ------------------------------------------------------------- nutrition
  const calorieData = useMemo<ChartPoint[]>(
    () => food.map((r) => ({ logged_on: r.logged_on, value: Number(r.calories) })),
    [food],
  )
  const proteinData = useMemo<ChartPoint[]>(
    () => food.map((r) => ({ logged_on: r.logged_on, value: Number(r.protein) })),
    [food],
  )

  const foodSummary = useMemo(() => {
    if (food.length === 0) return null
    let calories = 0
    let protein = 0
    let calorieDays = 0
    let proteinDays = 0
    for (const row of food) {
      const c = Number(row.calories)
      const p = Number(row.protein)
      calories += c
      protein += p
      if (c <= calorieTarget) calorieDays += 1
      if (p >= proteinTarget) proteinDays += 1
    }
    return {
      avgCalories: Math.round(calories / food.length),
      avgProtein: Math.round(protein / food.length),
      calorieDays,
      proteinDays,
      days: food.length,
    }
  }, [food, calorieTarget, proteinTarget])

  // -------------------------------------------------------------- training
  const volumeData = useMemo<ChartPoint[]>(
    () => workouts.map((r) => ({ logged_on: r.logged_on, value: Number(r.volume) })),
    [workouts],
  )

  const trainingSummary = useMemo(() => {
    if (workouts.length === 0) return null
    let volume = 0
    let sets = 0
    for (const w of workouts) {
      volume += Number(w.volume)
      sets += w.total_sets
    }
    return {
      sessions: workouts.length,
      totalVolume: Math.round(volume),
      avgVolume: Math.round(volume / workouts.length),
      totalSets: sets,
    }
  }, [workouts])

  // ------------------------------------------------------------------ body
  const weightData = useMemo<ChartPoint[]>(
    () =>
      logs
        .filter((l) => l.weight_kg != null)
        .map((l) => ({ logged_on: l.logged_on, value: Number(l.weight_kg) })),
    [logs],
  )

  const weightSummary = useMemo(() => {
    if (weightData.length === 0) return null
    const first = weightData[0].value
    const last = weightData[weightData.length - 1].value
    return {
      latest: round(last, 1),
      change: round(last - first, 1),
      weighIns: weightData.length,
    }
  }, [weightData])

  const nothingAtAll =
    !loading && food.length === 0 && workouts.length === 0 && weightData.length === 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Stats</h1>
        {/* One filter row above everything it scopes — every section below
            re-renders against the same slice. */}
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
      ) : nothingAtAll ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nothing logged in the last {range} days.{' '}
          <Link to="/" className="font-medium text-foreground underline underline-offset-4">
            Log something
          </Link>
          .
        </p>
      ) : (
        <Tabs defaultValue="nutrition">
          {/* The range filter above scopes every tab, so switching tabs keeps
              the same slice of days. */}
          <TabsList className="w-full">
            <TabsTrigger value="nutrition" className="flex-1">
              Nutrition
            </TabsTrigger>
            <TabsTrigger value="training" className="flex-1">
              Training
            </TabsTrigger>
            <TabsTrigger value="body" className="flex-1">
              Body
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nutrition" className="space-y-4 pt-4">
            {foodSummary ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile
                    kind="calories"
                    label="Avg calories"
                    value={foodSummary.avgCalories.toLocaleString()}
                    detail={`target ${calorieTarget.toLocaleString()}`}
                  />
                  <StatTile
                    kind="protein"
                    label="Avg protein"
                    value={`${foodSummary.avgProtein}g`}
                    detail={`target ${proteinTarget}g`}
                  />
                  <StatTile
                    label="Days under calories"
                    value={`${foodSummary.calorieDays}/${foodSummary.days}`}
                    detail="days logged"
                  />
                  <StatTile
                    label="Days hitting protein"
                    value={`${foodSummary.proteinDays}/${foodSummary.days}`}
                    detail="days logged"
                  />
                </div>

                <MetricChart
                  metric="calories"
                  title="Calories per day"
                  description={`Last ${range} days, against a ${calorieTarget.toLocaleString()} kcal target.`}
                  unit="kcal"
                  target={calorieTarget}
                  data={calorieData}
                />
                <MetricChart
                  metric="protein"
                  title="Protein per day"
                  description={`Last ${range} days, against a ${proteinTarget}g target.`}
                  unit="g"
                  target={proteinTarget}
                  data={proteinData}
                />
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No food logged in this range.
              </p>
            )}
          </TabsContent>

          <TabsContent value="training" className="space-y-4 pt-4">
            {trainingSummary ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile
                    kind="volume"
                    label="Avg volume"
                    value={`${trainingSummary.avgVolume.toLocaleString()} kg`}
                    detail="per session"
                  />
                  <StatTile
                    label="Sessions"
                    value={String(trainingSummary.sessions)}
                    detail={`in ${range} days`}
                  />
                  <StatTile
                    label="Total volume"
                    value={`${trainingSummary.totalVolume.toLocaleString()} kg`}
                    detail="weight x reps x sets"
                  />
                  <StatTile
                    label="Total sets"
                    value={trainingSummary.totalSets.toLocaleString()}
                    detail="across all exercises"
                  />
                </div>

                <MetricChart
                  metric="volume"
                  title="Training volume per day"
                  description={`Last ${range} days. Volume is weight x reps x sets.`}
                  unit="kg"
                  data={volumeData}
                />
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No workouts logged in this range.{' '}
                <Link to="/gym" className="font-medium text-foreground underline underline-offset-4">
                  Log a session
                </Link>
                .
              </p>
            )}
          </TabsContent>

          <TabsContent value="body" className="space-y-4 pt-4">
            {weightSummary ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile
                    kind="bodyweight"
                    label="Latest weight"
                    value={`${weightSummary.latest} kg`}
                    detail={`${weightSummary.weighIns} weigh-ins`}
                  />
                  <StatTile
                    label="Change"
                    value={`${weightSummary.change > 0 ? '+' : ''}${weightSummary.change} kg`}
                    detail={`over ${range} days`}
                  />
                </div>

                <MetricChart
                  metric="bodyweight"
                  title="Bodyweight"
                  description={`Last ${range} days. Only days you weighed in.`}
                  unit="kg"
                  kind="line"
                  data={weightData}
                />
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No weigh-ins in this range. Add one from{' '}
                <Link to="/" className="font-medium text-foreground underline underline-offset-4">
                  Today
                </Link>
                .
              </p>
            )}
          </TabsContent>

          <p className="pt-4 text-center text-xs text-muted-foreground">
            Every value here is also in{' '}
            <Link to="/history" className="underline underline-offset-4">
              History
            </Link>{' '}
            as a table.
          </p>
        </Tabs>
      )}
    </div>
  )
}
