import { AddFoodDialog } from '@/components/add-food-dialog'
import { MacroMeter } from '@/components/macro-meter'
import { WeighInField } from '@/components/weigh-in-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { deleteEntry, getDailyLog, listEntries, listFoods, recordWeighIn } from '@/lib/api'
import { grams, kcal, longDateLabel, num, todayKey, toDateKey, fromDateKey } from '@/lib/format'
import { MEAL_LABELS, MEALS, type DailyLog, type Food, type FoodEntry, type Meal } from '@/lib/types'
import { addDays, isAfter, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

export function TodayPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [dateKey, setDateKey] = useState(todayKey)
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [addMeal, setAddMeal] = useState<Meal>('breakfast')

  const userId = user?.id

  const loadDay = useCallback(async () => {
    if (!userId) return
    try {
      const [nextEntries, nextLog] = await Promise.all([
        listEntries(userId, dateKey),
        getDailyLog(userId, dateKey),
      ])
      setEntries(nextEntries)
      setDailyLog(nextLog)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load the day')
    } finally {
      setLoading(false)
    }
  }, [userId, dateKey])

  const loadFoods = useCallback(async () => {
    if (!userId) return
    try {
      setFoods(await listFoods(userId))
    } catch {
      // The food library is a convenience; a failure here shouldn't block logging.
    }
  }, [userId])

  useEffect(() => {
    setLoading(true)
    void loadDay()
  }, [loadDay])

  useEffect(() => {
    void loadFoods()
  }, [loadFoods])

  // Totals are derived, never stored, so they can't drift from the entries.
  const totals = useMemo(
    () =>
      entries.reduce(
        (acc, entry) => ({
          calories: acc.calories + Number(entry.calories),
          protein: acc.protein + Number(entry.protein),
          fiber: acc.fiber + Number(entry.fiber ?? 0),
        }),
        { calories: 0, protein: 0, fiber: 0 },
      ),
    [entries],
  )

  const calorieTarget = dailyLog?.calorie_target ?? profile?.calorie_target ?? 2400
  const proteinTarget = dailyLog?.protein_target ?? profile?.protein_target ?? 140
  const fiberTarget = dailyLog?.fiber_target ?? profile?.fiber_target ?? 30

  const byMeal = useMemo(() => {
    const groups = new Map<Meal, FoodEntry[]>(MEALS.map((m) => [m, []]))
    for (const entry of entries) groups.get(entry.meal)?.push(entry)
    return groups
  }, [entries])

  const isToday = dateKey === todayKey()
  const canGoForward = !isAfter(startOfDay(addDays(fromDateKey(dateKey), 1)), startOfDay(new Date()))

  async function onDelete(entry: FoodEntry) {
    // Optimistic: the row disappears immediately, restored if the delete fails.
    const previous = entries
    setEntries((current) => current.filter((e) => e.id !== entry.id))
    try {
      await deleteEntry(entry.id)
    } catch (error) {
      setEntries(previous)
      toast.error(error instanceof Error ? error.message : 'Could not remove that entry')
    }
  }

  async function onWeighIn(weightKg: number | null) {
    if (!userId) return
    try {
      setDailyLog(await recordWeighIn(userId, dateKey, weightKg))
      // The profile's current weight changed too, so BMI stays in step.
      await refreshProfile()
      toast.success(weightKg === null ? 'Weigh-in cleared' : `Weight saved: ${weightKg} kg`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your weight')
    }
  }

  function openAdd(meal: Meal) {
    setAddMeal(meal)
    setAddOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------ date nav */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous day"
          onClick={() => setDateKey(toDateKey(addDays(fromDateKey(dateKey), -1)))}
        >
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <h1 className="text-lg font-semibold tracking-tight">{longDateLabel(dateKey)}</h1>
          {!isToday && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-4"
              onClick={() => setDateKey(todayKey())}
            >
              Jump to today
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next day"
          disabled={!canGoForward}
          onClick={() => setDateKey(toDateKey(addDays(fromDateKey(dateKey), 1)))}
        >
          <ChevronRight />
        </Button>
      </div>

      {/* ------------------------------------------------------- the meters */}
      <Card>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          {loading ? (
            <>
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </>
          ) : (
            <>
              <MacroMeter
                kind="calories"
                label="Calories"
                value={totals.calories}
                target={calorieTarget}
                unit="kcal"
                hero
              />
              <MacroMeter
                kind="protein"
                label="Protein"
                value={totals.protein}
                target={proteinTarget}
                unit="g"
              />
              <MacroMeter
                kind="fiber"
                label="Fibre"
                value={totals.fiber}
                target={fiberTarget}
                unit="g"
              />
            </>
          )}
        </CardContent>
      </Card>

      {!loading && (
        <Card>
          <CardContent>
            <WeighInField value={dailyLog?.weight_kg ?? null} onSave={onWeighIn} />
          </CardContent>
        </Card>
      )}

      {/* --------------------------------------------------------- meals */}
      <div className="space-y-4">
        {MEALS.map((meal) => {
          const items = byMeal.get(meal) ?? []
          const mealTotals = items.reduce(
            (acc, e) => ({
              calories: acc.calories + Number(e.calories),
              protein: acc.protein + Number(e.protein),
            }),
            { calories: 0, protein: 0 },
          )

          return (
            <section key={meal}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
                <h2 className="text-sm font-semibold">{MEAL_LABELS[meal]}</h2>
                {items.length > 0 && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {kcal(mealTotals.calories)} kcal · {grams(mealTotals.protein)}
                  </span>
                )}
              </div>

              <Card>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="space-y-2 p-3">
                      <Skeleton className="h-5" />
                      <Skeleton className="h-5 w-2/3" />
                    </div>
                  ) : items.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">Nothing logged.</p>
                  ) : (
                    <ul className="divide-y">
                      {items.map((entry) => (
                        <li
                          key={entry.id}
                          className="group flex items-center gap-3 px-4 py-2.5 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{entry.food_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {num(Number(entry.quantity))} {entry.unit}
                            </p>
                          </div>
                          <div className="shrink-0 text-right tabular-nums">
                            <p>{kcal(Number(entry.calories))} kcal</p>
                            <p className="text-xs text-muted-foreground">
                              {grams(Number(entry.protein))} protein
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${entry.food_name}`}
                            className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={() => void onDelete(entry)}
                          >
                            <Trash2 />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="border-t p-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground"
                      onClick={() => openAdd(meal)}
                    >
                      <Plus /> Add to {MEAL_LABELS[meal].toLowerCase()}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )
        })}
      </div>

      {userId && (
        <AddFoodDialog
          // Remount when the target meal or day changes so the form picks up
          // the new defaults instead of keeping the previous ones.
          key={`${addMeal}-${dateKey}`}
          open={addOpen}
          onOpenChange={setAddOpen}
          userId={userId}
          dateKey={dateKey}
          defaultMeal={addMeal}
          foods={foods}
          onSaved={() => void loadDay()}
          onFoodCreated={() => void loadFoods()}
        />
      )}
    </div>
  )
}
