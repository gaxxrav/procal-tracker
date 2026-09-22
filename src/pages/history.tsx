import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { listDailyTotals } from '@/lib/api'
import { grams, kcal, longDateLabel, toDateKey } from '@/lib/format'
import type { DailyTotals } from '@/lib/types'
import { format, subDays } from 'date-fns'
import { Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

const DAYS = 60

export function HistoryPage() {
  const { user, profile } = useAuth()
  const [rows, setRows] = useState<DailyTotals[]>([])
  const [loading, setLoading] = useState(true)

  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    const to = toDateKey(new Date())
    const from = toDateKey(subDays(new Date(), DAYS - 1))
    listDailyTotals(userId, from, to)
      .then((data) => setRows(data.slice().reverse()))
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : 'Could not load history'),
      )
      .finally(() => setLoading(false))
  }, [userId])

  const calorieTarget = profile?.calorie_target ?? 2400
  const proteinTarget = profile?.protein_target ?? 140

  // Group by month so a long history stays scannable.
  const months = useMemo(() => {
    const groups = new Map<string, DailyTotals[]>()
    for (const row of rows) {
      const key = format(new Date(`${row.logged_on}T00:00:00`), 'MMMM yyyy')
      const list = groups.get(key)
      if (list) list.push(row)
      else groups.set(key, [row])
    }
    return [...groups.entries()]
  }, [rows])

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
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">
          The last {DAYS} days you logged anything. Targets {calorieTarget.toLocaleString()} kcal ·{' '}
          {proteinTarget}g protein.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing logged yet.{' '}
            <Link to="/" className="font-medium text-foreground underline underline-offset-4">
              Start with today
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        months.map(([month, days]) => (
          <section key={month}>
            <h2 className="mb-1.5 px-1 text-sm font-semibold">{month}</h2>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Daily calories and protein for {month}, with target hits marked.
                  </caption>
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Day</th>
                      <th scope="col">Calories</th>
                      <th scope="col">Protein</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {days.map((day) => {
                      const calories = Number(day.calories)
                      const protein = Number(day.protein)
                      const calOk = calories <= calorieTarget
                      const proOk = protein >= proteinTarget
                      return (
                        <tr key={day.logged_on}>
                          <th scope="row" className="px-4 py-2.5 text-left font-medium">
                            {longDateLabel(day.logged_on)}
                            <span className="ml-2 font-normal text-xs text-muted-foreground">
                              {day.entry_count} {day.entry_count === 1 ? 'item' : 'items'}
                            </span>
                          </th>
                          <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              {calOk && (
                                <Check
                                  className="size-3.5"
                                  style={{ color: 'var(--status-good)' }}
                                  aria-label="within calorie target"
                                />
                              )}
                              {kcal(calories)} kcal
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              {proOk && (
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
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </section>
        ))
      )}
    </div>
  )
}
