import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { updateProfile } from '@/lib/api'
import { ageFrom, bmi, num, todayKey } from '@/lib/format'
import { GENDERS, GENDER_LABELS, type Gender } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

export function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [calorieTarget, setCalorieTarget] = useState('')
  const [proteinTarget, setProteinTarget] = useState('')
  const [fiberTarget, setFiberTarget] = useState('')
  const [busy, setBusy] = useState(false)

  // Personal stats
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [bodyBusy, setBodyBusy] = useState(false)

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.display_name ?? '')
    setCalorieTarget(String(profile.calorie_target))
    setProteinTarget(String(profile.protein_target))
    setFiberTarget(String(profile.fiber_target ?? 30))
    setHeightCm(profile.height_cm == null ? '' : num(Number(profile.height_cm)))
    setWeightKg(profile.weight_kg == null ? '' : num(Number(profile.weight_kg)))
    setBirthDate(profile.birth_date ?? '')
    setGender(profile.gender ?? '')
  }, [profile])

  // Recomputed from whatever is currently in the two inputs, so it updates as
  // you type rather than only after saving.
  const currentBmi = useMemo(
    () => bmi(Number(heightCm) || null, Number(weightKg) || null),
    [heightCm, weightKg],
  )

  // Derived, so it never goes stale the way a stored age would.
  const derivedAge = useMemo(() => ageFrom(birthDate || null), [birthDate])

  async function onSubmitBody(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return
    const h = heightCm.trim() === '' ? null : Number(heightCm)
    const w = weightKg.trim() === '' ? null : Number(weightKg)
    const b = birthDate.trim() === '' ? null : birthDate
    if (h !== null && !(h > 0 && h < 300)) {
      toast.error('Height must be between 0 and 300 cm.')
      return
    }
    if (w !== null && !(w > 0 && w < 700)) {
      toast.error('Weight must be between 0 and 700 kg.')
      return
    }
    if (b !== null && ageFrom(b) === null) {
      toast.error('Date of birth must be a valid date in the past.')
      return
    }
    setBodyBusy(true)
    try {
      await updateProfile(user.id, {
        height_cm: h,
        weight_kg: w,
        birth_date: b,
        gender: gender === '' ? null : gender,
      })
      await refreshProfile()
      toast.success('Personal stats updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your stats')
    } finally {
      setBodyBusy(false)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return
    const calories = Number(calorieTarget)
    const protein = Number(proteinTarget)
    const fiberT = Number(fiberTarget)
    if (
      !Number.isInteger(calories) || calories <= 0 ||
      !Number.isInteger(protein) || protein <= 0 ||
      !Number.isInteger(fiberT) || fiberT <= 0
    ) {
      toast.error('Targets must be whole numbers above zero.')
      return
    }
    setBusy(true)
    try {
      await updateProfile(user.id, {
        display_name: displayName.trim() || null,
        calorie_target: calories,
        protein_target: protein,
        fiber_target: fiberT,
      })
      await refreshProfile()
      toast.success('Targets updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save your settings')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Daily targets</CardTitle>
          <CardDescription>
            Defaults for every day. A single day can override these without changing them here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="calorie-target">Calories</Label>
                <Input
                  id="calorie-target"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={calorieTarget}
                  onChange={(e) => setCalorieTarget(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="protein-target">Protein (g)</Label>
                <Input
                  id="protein-target"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={proteinTarget}
                  onChange={(e) => setProteinTarget(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fiber-target">Fibre (g)</Label>
                <Input
                  id="fiber-target"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={fiberTarget}
                  onChange={(e) => setFiberTarget(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal stats</CardTitle>
          <CardDescription>Used for BMI, and for future calorie estimates.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmitBody} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="175"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Current weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="72"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Updated automatically whenever you weigh in on Today.
                </p>
              </div>
            </div>

            {/* Derived, never stored — read-only so it can't be edited out of
                sync with the height and weight above it. */}
            <div className="space-y-2">
              <Label htmlFor="bmi" className="text-muted-foreground">
                BMI
              </Label>
              <div
                id="bmi"
                aria-live="polite"
                className="flex h-9 items-center justify-between rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground"
              >
                {currentBmi ? (
                  <>
                    <span className="font-medium tabular-nums">{currentBmi.value}</span>
                    <span className="text-xs">{currentBmi.category}</span>
                  </>
                ) : (
                  <span className="text-xs">Enter height and weight</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Calculated automatically. BMI ignores muscle mass, so treat it loosely if
                you lift.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="birth-date">Date of birth</Label>
                <Input
                  id="birth-date"
                  type="date"
                  max={todayKey()}
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {derivedAge === null ? 'Age is worked out from this.' : `Age ${derivedAge}.`}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                  <SelectTrigger id="gender" className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {GENDER_LABELS[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={bodyBusy}>
              {bodyBusy && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
