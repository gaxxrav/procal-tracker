import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createWorkoutEntry, updateWorkoutEntry, type NewWorkoutEntry } from '@/lib/api'
import { num, volume } from '@/lib/format'
import type { WorkoutEntry } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  userId: string
  dateKey: string
  /** Present when editing an existing entry. */
  entry: WorkoutEntry | null
  /** Previously used exercise names, for the autocomplete. */
  suggestions: string[]
  onClose: () => void
  onSaved: () => void
}

export function AddExerciseDialog({
  userId,
  dateKey,
  entry,
  suggestions,
  onClose,
  onSaved,
}: Props) {
  const [exercise, setExercise] = useState(entry?.exercise ?? '')
  const [weight, setWeight] = useState(entry ? num(Number(entry.weight_kg)) : '')
  const [reps, setReps] = useState(entry ? String(entry.reps) : '')
  const [sets, setSets] = useState(entry ? String(entry.sets) : '3')
  const [busy, setBusy] = useState(false)

  const w = Number(weight)
  const r = Number(reps)
  const s = Number(sets)
  const preview =
    Number.isFinite(w) && w >= 0 && r > 0 && s > 0 ? volume(w, r, s) : null

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const patch: NewWorkoutEntry = {
      logged_on: dateKey,
      exercise: exercise.trim(),
      weight_kg: w,
      reps: r,
      sets: s,
    }
    if (!patch.exercise) {
      toast.error('Give the exercise a name.')
      return
    }
    if (!Number.isFinite(w) || w < 0 || !Number.isInteger(r) || r < 1 || !Number.isInteger(s) || s < 1) {
      toast.error('Weight must be 0 or more; reps and sets must be whole numbers of 1 or more.')
      return
    }
    setBusy(true)
    try {
      if (entry) await updateWorkoutEntry(entry.id, patch)
      else await createWorkoutEntry(userId, patch)
      toast.success(entry ? `Updated ${patch.exercise}` : `Logged ${patch.exercise}`)
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save that exercise')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? 'Edit exercise' : 'Add exercise'}</DialogTitle>
          <DialogDescription>
            One line per weight used. Log the same exercise again for a different
            weight.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="exercise">Exercise</Label>
            <Input
              id="exercise"
              list="exercise-suggestions"
              placeholder="Bench press"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              autoComplete="off"
              required
            />
            <datalist id="exercise-suggestions">
              {suggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder="80"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reps">Reps</Label>
              <Input
                id="reps"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                placeholder="8"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sets">Sets</Label>
              <Input
                id="sets"
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                required
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {preview !== null ? (
              <>
                Volume{' '}
                <span className="font-medium text-foreground">
                  {preview.toLocaleString()} kg
                </span>{' '}
                ({num(w)} × {r} × {s}). Use 0 kg for bodyweight.
              </>
            ) : (
              'Use 0 kg for bodyweight movements.'
            )}
          </p>

          <DialogFooter>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {entry ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
