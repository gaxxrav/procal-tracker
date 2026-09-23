import { AddExerciseDialog } from '@/components/add-exercise-dialog'
import { EnergyPicker } from '@/components/energy-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import {
  deleteWorkoutEntry,
  getDailyLog,
  listExerciseNames,
  listWorkoutEntries,
  upsertDailyLog,
} from '@/lib/api'
import { fromDateKey, longDateLabel, num, toDateKey, todayKey, volume } from '@/lib/format'
import type { DailyLog, WorkoutEntry } from '@/lib/types'
import { addDays, isAfter, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight, Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

export function WorkoutsPage() {
  const { user } = useAuth()
  const [dateKey, setDateKey] = useState(todayKey)
  const [entries, setEntries] = useState<WorkoutEntry[]>([])
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<WorkoutEntry | null>(null)

  const userId = user?.id

  const loadDay = useCallback(async () => {
    if (!userId) return
    try {
      const [nextEntries, nextLog] = await Promise.all([
        listWorkoutEntries(userId, dateKey),
        getDailyLog(userId, dateKey),
      ])
      setEntries(nextEntries)
      setDailyLog(nextLog)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load that day')
    } finally {
      setLoading(false)
    }
  }, [userId, dateKey])

  useEffect(() => {
    setLoading(true)
    void loadDay()
  }, [loadDay])

  useEffect(() => {
    if (!userId) return
    listExerciseNames(userId)
      .then(setSuggestions)
      .catch(() => {
        // Autocomplete is a nicety; failing to load it shouldn't block logging.
      })
  }, [userId, entries.length])

  const totals = useMemo(() => {
    let totalVolume = 0
    let totalSets = 0
    for (const e of entries) {
      totalVolume += volume(Number(e.weight_kg), e.reps, e.sets)
      totalSets += e.sets
    }
    return {
      volume: totalVolume,
      sets: totalSets,
      exercises: new Set(entries.map((e) => e.exercise.toLowerCase())).size,
    }
  }, [entries])

  const isToday = dateKey === todayKey()
  const canGoForward = !isAfter(startOfDay(addDays(fromDateKey(dateKey), 1)), startOfDay(new Date()))

  async function onEnergyChange(level: number | null) {
    if (!userId) return
    const previous = dailyLog
    setDailyLog((current) => (current ? { ...current, energy_level: level } : current))
    try {
      setDailyLog(await upsertDailyLog(userId, dateKey, { energy_level: level }))
    } catch (error) {
      setDailyLog(previous)
      toast.error(error instanceof Error ? error.message : 'Could not save your energy level')
    }
  }

  async function onDelete(entry: WorkoutEntry) {
    const previous = entries
    setEntries((current) => current.filter((e) => e.id !== entry.id))
    try {
      await deleteWorkoutEntry(entry.id)
    } catch (error) {
      setEntries(previous)
      toast.error(error instanceof Error ? error.message : 'Could not remove that exercise')
    }
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- date nav */}
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

      {/* ------------------------------------------- day summary + energy */}
      <Card>
        <CardContent className="space-y-5">
          {loading ? (
            <Skeleton className="h-24" />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-semibold tracking-tight">
                    {totals.volume.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">kg volume</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{totals.sets}</p>
                  <p className="text-xs text-muted-foreground">
                    {totals.sets === 1 ? 'set' : 'sets'}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{totals.exercises}</p>
                  <p className="text-xs text-muted-foreground">
                    {totals.exercises === 1 ? 'exercise' : 'exercises'}
                  </p>
                </div>
              </div>

              <EnergyPicker value={dailyLog?.energy_level ?? null} onChange={onEnergyChange} />
            </>
          )}
        </CardContent>
      </Card>

      {/* --------------------------------------------------------- lifts */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-5" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : entries.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Dumbbell className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nothing logged for this day.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {entries.map((entry) => (
                <li key={entry.id} className="group flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{entry.exercise}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {Number(entry.weight_kg) === 0
                        ? 'Bodyweight'
                        : `${num(Number(entry.weight_kg))} kg`}{' '}
                      × {entry.reps} reps × {entry.sets} sets
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {volume(Number(entry.weight_kg), entry.reps, entry.sets).toLocaleString()} kg
                  </p>
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${entry.exercise}`}
                      onClick={() => setEditing(entry)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${entry.exercise}`}
                      className="text-muted-foreground"
                      onClick={() => void onDelete(entry)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t p-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setAdding(true)}
            >
              <Plus /> Add exercise
            </Button>
          </div>
        </CardContent>
      </Card>

      {userId && (adding || editing) && (
        <AddExerciseDialog
          key={editing?.id ?? `new-${dateKey}`}
          userId={userId}
          dateKey={dateKey}
          entry={editing}
          suggestions={suggestions}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSaved={() => void loadDay()}
        />
      )}
    </div>
  )
}
