import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { updateProfile } from '@/lib/api'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [calorieTarget, setCalorieTarget] = useState('')
  const [proteinTarget, setProteinTarget] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.display_name ?? '')
    setCalorieTarget(String(profile.calorie_target))
    setProteinTarget(String(profile.protein_target))
  }, [profile])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return
    const calories = Number(calorieTarget)
    const protein = Number(proteinTarget)
    if (!Number.isInteger(calories) || calories <= 0 || !Number.isInteger(protein) || protein <= 0) {
      toast.error('Targets must be whole numbers above zero.')
      return
    }
    setBusy(true)
    try {
      await updateProfile(user.id, {
        display_name: displayName.trim() || null,
        calorie_target: calories,
        protein_target: protein,
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="calorie-target">Calories (kcal)</Label>
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
