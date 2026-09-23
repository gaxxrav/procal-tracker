import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { listDailyLogs, listDailyTotals, listDailyWorkoutTotals } from '@/lib/api'
import { grams, kcal, longDateLabel, num, toDateKey } from '@/lib/format'
import { ENERGY_LABELS, type DailyLog, type DailyTotals, type DailyWorkoutTotals } from '@/lib/types'
import { format, subDays } from 'date-fns'
import { Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

const DAYS = 60

/** Groups date-keyed rows by month, newest month first. */
function byMonth<T extends { logged_on: string }>(rows: T[]): Array<[string, T[]]> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const key = format(new Date(`${row.logged_on}T00:00:00`), 'MMMM yyyy')
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }
  return [...groups.entries()]
}

function MonthTable({
  month,
  caption,
  headers,
  children,
}: {
  month: string
  caption: string
  headers: string[]
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-sm font-semibold">{month}</h3>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="sr-only">
              <tr>
                {headers.map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">{children}</tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  )
}

export function HistoryPage() {
  const { user, profile } = useAuth()
  const [food, setFood] = useState<DailyTotals[]>([])
  const [workouts, setWorkouts] = useState<DailyWorkoutTotals[]>([])
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)

  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    const to = toDateKey(new Date())
    const from = toDateKey(subDays(new Date(), DAYS - 1))
    Promise.all([
      listDailyTotals(userId, from, to),
      listDailyWorkoutTotals(userId, from, to),
      listDailyLogs(userId, from, to),
    ])
      .then(([f, w, l]) => {
        // Newest first for reading; the charts want oldest first.
        setFood(f.slice().reverse())
        setWorkouts(w.slice().reverse())
        setLogs(l.slice().reverse())
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : 'Could not load history'),
      )
      .finally(() => setLoading(false))
  }, [userId])

  const calorieTarget = profile?.calorie_target ?? 2400
  const proteinTarget = profile?.protein_target ?? 140

  const energyByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of logs) if (l.energy_level != null) map.set(l.logged_on, l.energy_level)
    return map
  }, [logs])

  const weighIns = useMemo(() => logs.filter((l) => l.weight_kg != null), [logs])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">The last {DAYS} days, as tables.</p>
      </div>

      <Tabs defaultValue="nutrition">
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

        {/* ---------------------------------------------------- nutrition */}
        <TabsContent value="nutrition" className="space-y-5 pt-4">
          <p className="px-1 text-xs text-muted-foreground">
            Targets {calorieTarget.toLocaleString()} kcal · {proteinTarget}g protein.
          </p>
          {food.length === 0 ? (
            <Empty>
              Nothing logged yet.{' '}
              <Link to="/" className="font-medium text-foreground underline underline-offset-4">
                Start with today
              </Link>
              .
            </Empty>
          ) : (
            byMonth(food).map(([month, days]) => (
              <MonthTable
                key={month}
                month={month}
                caption={`Daily calories and protein for ${month}, with target hits marked.`}
                headers={['Day', 'Calories', 'Protein']}
              >
                {days.map((day) => {
                  const calories = Number(day.calories)
                  const protein = Number(day.protein)
                  return (
                    <tr key={day.logged_on}>
                      <th scope="row" className="px-4 py-2.5 text-left font-medium">
                        {longDateLabel(day.logged_on)}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {day.entry_count} {day.entry_count === 1 ? 'item' : 'items'}
                        </span>
                      </th>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          {calories <= calorieTarget && (
                            <Check
                              className="size-3.5"
                              style={{ color: 'var(--status-good)' }}
                              aria-label="within calorie target"
                            />
                          )}
                          {kcal(calories)} kcal
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          {protein >= proteinTarget && (
                            <Check
                              className="size-3.5"
                              style={{ color: 'var(--status-good)' }}
                              aria-label="protein target hit"
                            />
                          )}
                          {grams(protein)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </MonthTable>
            ))
          )}
        </TabsContent>

        {/* ----------------------------------------------------- training */}
        <TabsContent value="training" className="space-y-5 pt-4">
          {workouts.length === 0 ? (
            <Empty>
              No workouts logged yet.{' '}
              <Link to="/gym" className="font-medium text-foreground underline underline-offset-4">
                Log a session
              </Link>
              .
            </Empty>
          ) : (
            byMonth(workouts).map(([month, days]) => (
              <MonthTable
                key={month}
                month={month}
                caption={`Daily training volume, sets and exercises for ${month}.`}
                headers={['Day', 'Volume', 'Sets']}
              >
                {days.map((day) => {
                  const energy = energyByDate.get(day.logged_on)
                  return (
                    <tr key={day.logged_on}>
                      <th scope="row" className="px-4 py-2.5 text-left font-medium">
                        {longDateLabel(day.logged_on)}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {day.exercises} {day.exercises === 1 ? 'exercise' : 'exercises'}
                          {energy != null && ` · energy ${energy} (${ENERGY_LABELS[energy]})`}
                        </span>
                      </th>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
                        {Math.round(Number(day.volume)).toLocaleString()} kg
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {day.total_sets} {day.total_sets === 1 ? 'set' : 'sets'}
                      </td>
                    </tr>
                  )
                })}
              </MonthTable>
            ))
          )}
        </TabsContent>

        {/* --------------------------------------------------------- body */}
        <TabsContent value="body" className="space-y-5 pt-4">
          {weighIns.length === 0 ? (
            <Empty>
              No weigh-ins yet. Add one from{' '}
              <Link to="/" className="font-medium text-foreground underline underline-offset-4">
                Today
              </Link>
              .
            </Empty>
          ) : (
            byMonth(weighIns).map(([month, days]) => (
              <MonthTable
                key={month}
                month={month}
                caption={`Bodyweight weigh-ins for ${month}.`}
                headers={['Day', 'Weight']}
              >
                {days.map((day) => (
                  <tr key={day.logged_on}>
                    <th scope="row" className="px-4 py-2.5 text-left font-medium">
                      {longDateLabel(day.logged_on)}
                    </th>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                      {num(Number(day.weight_kg))} kg
                    </td>
                  </tr>
                ))}
              </MonthTable>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
