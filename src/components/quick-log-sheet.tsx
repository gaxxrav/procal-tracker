import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createEntry, createWorkoutEntry, recordWeighIn, upsertDailyLog } from '@/lib/api'
import { grams, kcal, longDateLabel, num } from '@/lib/format'
import {
  isEmptyParse,
  parseQuickLog,
  speechSupported,
  startDictation,
  type ParsedExercise,
  type ParsedFood,
  type ParsedLog,
} from '@/lib/quick-log'
import { ENERGY_LABELS, MEAL_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Loader2, Mic, Sparkles, Square, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  /** The day the user is currently looking at; the parser can override it. */
  dateKey: string
  onSaved: () => void
}

/** Each row can be excluded before saving, so review is a real gate. */
type Row<T> = { item: T; include: boolean }

const EXAMPLES = [
  'two idlis and a filter coffee',
  'bench 80 by 8 for 3, felt strong',
  '78.2 kg this morning',
  'rajma chawal for lunch and pull-ups 3 sets of 10',
]

export function QuickLogSheet({ open, onOpenChange, userId, dateKey, onSaved }: Props) {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [listening, setListening] = useState(false)
  const stopDictation = useRef<(() => void) | null>(null)

  const [parsed, setParsed] = useState<ParsedLog | null>(null)
  const [foodRows, setFoodRows] = useState<Array<Row<ParsedFood>>>([])
  const [exerciseRows, setExerciseRows] = useState<Array<Row<ParsedExercise>>>([])
  const [includeWeight, setIncludeWeight] = useState(true)
  const [includeEnergy, setIncludeEnergy] = useState(true)

  useEffect(() => {
    return () => stopDictation.current?.()
  }, [])

  function reset() {
    stopDictation.current?.()
    setListening(false)
    setText('')
    setParsed(null)
    setFoodRows([])
    setExerciseRows([])
    setIncludeWeight(true)
    setIncludeEnergy(true)
    setParsing(false)
    setSaving(false)
  }

  function close() {
    reset()
    onOpenChange(false)
  }

  function toggleDictation() {
    if (listening) {
      stopDictation.current?.()
      return
    }
    setListening(true)
    stopDictation.current = startDictation(
      (transcript) => setText((current) => (current ? `${current} ${transcript}` : transcript)),
      (message) => toast.error(message),
      () => setListening(false),
    )
  }

  async function onParse(event: React.FormEvent) {
    event.preventDefault()
    const input = text.trim()
    if (!input) return
    stopDictation.current?.()
    setParsing(true)
    try {
      const result = await parseQuickLog(input, dateKey)
      if (isEmptyParse(result)) {
        toast.error("Couldn't find anything to log in that. Try being more specific.")
        return
      }
      setParsed(result)
      setFoodRows(result.foods.map((item) => ({ item, include: true })))
      setExerciseRows(result.exercises.map((item) => ({ item, include: true })))
      setIncludeWeight(result.weight_kg != null)
      setIncludeEnergy(result.energy_level != null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not parse that.')
    } finally {
      setParsing(false)
    }
  }

  async function onConfirm() {
    if (!parsed) return
    const foods = foodRows.filter((r) => r.include).map((r) => r.item)
    const exercises = exerciseRows.filter((r) => r.include).map((r) => r.item)
    const weight = includeWeight ? parsed.weight_kg : null
    const energy = includeEnergy ? parsed.energy_level : null

    if (foods.length === 0 && exercises.length === 0 && weight == null && energy == null) {
      toast.error('Nothing selected to save.')
      return
    }

    setSaving(true)
    try {
      // Sequential rather than parallel: a partial failure should leave a
      // clear picture of what landed, and this is a handful of rows.
      for (const food of foods) {
        await createEntry(userId, {
          logged_on: parsed.logged_on,
          meal: food.meal,
          food_name: food.name,
          quantity: food.quantity,
          unit: food.unit,
          calories: food.calories,
          protein: food.protein,
          fiber: food.fiber,
        })
      }
      for (const exercise of exercises) {
        await createWorkoutEntry(userId, {
          logged_on: parsed.logged_on,
          exercise: exercise.exercise,
          weight_kg: exercise.weight_kg,
          reps: exercise.reps,
          sets: exercise.sets,
        })
      }
      if (weight != null) await recordWeighIn(userId, parsed.logged_on, weight)
      if (energy != null) {
        await upsertDailyLog(userId, parsed.logged_on, { energy_level: energy })
      }

      const parts = [
        foods.length && `${foods.length} food${foods.length > 1 ? 's' : ''}`,
        exercises.length && `${exercises.length} exercise${exercises.length > 1 ? 's' : ''}`,
        weight != null && 'weight',
        energy != null && 'energy',
      ].filter(Boolean)
      toast.success(`Logged ${parts.join(', ')}`)
      onSaved()
      close()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save everything')
    } finally {
      setSaving(false)
    }
  }

  const estimatedCount = foodRows.filter((r) => r.include && r.item.source === 'estimated').length

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick log</DialogTitle>
          <DialogDescription>
            {parsed
              ? 'Check this over. Nothing is saved until you confirm.'
              : 'Say or type everything at once — food, lifts, weight, how you felt.'}
          </DialogDescription>
        </DialogHeader>

        {/* ------------------------------------------------------- compose */}
        {!parsed && (
          <form onSubmit={onParse} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="quick-log-text" className="sr-only">
                What did you eat or do?
              </Label>
              <Textarea
                id="quick-log-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="two idlis and a coffee, bench 80x8x3, 78.2kg"
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault()
                    void onParse(e)
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                On iPhone, tap the microphone on your keyboard to dictate.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setText(example)}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {example}
                </button>
              ))}
            </div>

            <DialogFooter className="gap-2 sm:flex-row">
              {speechSupported() && (
                <Button
                  type="button"
                  variant={listening ? 'destructive' : 'outline'}
                  size="lg"
                  onClick={toggleDictation}
                  aria-label={listening ? 'Stop dictation' : 'Start dictation'}
                >
                  {listening ? <Square /> : <Mic />}
                  {listening ? 'Stop' : 'Speak'}
                </Button>
              )}
              <Button type="submit" size="lg" className="flex-1" disabled={parsing || !text.trim()}>
                {parsing ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {parsing ? 'Reading…' : 'Review'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* -------------------------------------------------------- review */}
        {parsed && (
          <div className="space-y-4">
            {parsed.logged_on !== dateKey && (
              <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                Logging to <span className="font-medium text-foreground">{longDateLabel(parsed.logged_on)}</span>,
                not the day you were viewing.
              </p>
            )}

            {foodRows.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground">Food</h3>
                <ul className="divide-y rounded-lg border">
                  {foodRows.map((row, index) => (
                    <li key={`${row.item.name}-${index}`} className="flex items-start gap-3 p-3">
                      <Checkbox
                        className="mt-0.5"
                        checked={row.include}
                        onCheckedChange={(v) =>
                          setFoodRows((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, include: v === true } : r)),
                          )
                        }
                        aria-label={`Include ${row.item.name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {num(row.item.quantity)} {row.item.unit} · {MEAL_LABELS[row.item.meal]}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                          {kcal(row.item.calories)} kcal · {grams(row.item.protein)} P ·{' '}
                          {grams(row.item.fiber)} fib
                        </p>
                        {row.item.source === 'estimated' ? (
                          <p
                            className="mt-1 inline-flex items-center gap-1 text-xs"
                            style={{ color: 'var(--status-warning)' }}
                          >
                            <TriangleAlert className="size-3" /> Estimated — not in your library
                          </p>
                        ) : (
                          row.item.spoken_as.toLowerCase() !== row.item.name.toLowerCase() && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              matched from “{row.item.spoken_as}”
                            </p>
                          )
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {exerciseRows.length > 0 && (
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground">Training</h3>
                <ul className="divide-y rounded-lg border">
                  {exerciseRows.map((row, index) => (
                    <li key={`${row.item.exercise}-${index}`} className="flex items-center gap-3 p-3">
                      <Checkbox
                        checked={row.include}
                        onCheckedChange={(v) =>
                          setExerciseRows((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, include: v === true } : r)),
                          )
                        }
                        aria-label={`Include ${row.item.exercise}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.item.exercise}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {row.item.weight_kg === 0
                            ? 'Bodyweight'
                            : `${num(row.item.weight_kg)} kg`}{' '}
                          × {row.item.reps} reps × {row.item.sets} sets
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(parsed.weight_kg != null || parsed.energy_level != null) && (
              <section className="space-y-1.5">
                <h3 className="text-xs font-semibold text-muted-foreground">Day</h3>
                <ul className="divide-y rounded-lg border">
                  {parsed.weight_kg != null && (
                    <li className="flex items-center gap-3 p-3">
                      <Checkbox
                        checked={includeWeight}
                        onCheckedChange={(v) => setIncludeWeight(v === true)}
                        aria-label="Include weigh-in"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Weigh-in</p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {num(parsed.weight_kg)} kg
                        </p>
                      </div>
                    </li>
                  )}
                  {parsed.energy_level != null && (
                    <li className="flex items-center gap-3 p-3">
                      <Checkbox
                        checked={includeEnergy}
                        onCheckedChange={(v) => setIncludeEnergy(v === true)}
                        aria-label="Include energy level"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Energy</p>
                        <p className="text-xs text-muted-foreground">
                          {parsed.energy_level} — {ENERGY_LABELS[parsed.energy_level]}
                        </p>
                      </div>
                    </li>
                  )}
                </ul>
              </section>
            )}

            {parsed.unparsed.length > 0 && (
              <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                Skipped: {parsed.unparsed.join('; ')}
              </p>
            )}

            {estimatedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {estimatedCount} item{estimatedCount > 1 ? 's' : ''} use estimated numbers. Edit
                them after saving if you want exact values.
              </p>
            )}

            <DialogFooter className="gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setParsed(null)}
                disabled={saving}
              >
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                className={cn('flex-1')}
                onClick={() => void onConfirm()}
                disabled={saving}
              >
                {saving && <Loader2 className="animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
