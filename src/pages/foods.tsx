import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { deleteFood, listFoods, updateFood, upsertFood, type NewFood } from '@/lib/api'
import { grams, kcal, num } from '@/lib/format'
import { UNITS, type Food } from '@/lib/types'
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

export function FoodsPage() {
  const { user } = useAuth()
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Food | null>(null)
  const [creating, setCreating] = useState(false)

  const userId = user?.id

  async function refresh() {
    if (!userId) return
    try {
      setFoods(await listFoods(userId))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load your foods')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods
  }, [foods, query])

  async function onDelete(food: Food) {
    const previous = foods
    setFoods((current) => current.filter((f) => f.id !== food.id))
    try {
      await deleteFood(food.id)
      toast.success(`Removed ${food.name}`)
    } catch (error) {
      setFoods(previous)
      toast.error(error instanceof Error ? error.message : 'Could not remove that food')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">My foods</h1>
          <p className="text-sm text-muted-foreground">
            Things you eat often, stored per serving so logging is one tap.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> New
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search"
          className="pl-8"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {foods.length === 0
                  ? 'No saved foods yet. Add one, or tick “Save to my foods” when you log something.'
                  : `Nothing matches “${query}”.`}
              </p>
            ) : (
              <ul className="divide-y">
                {visible.map((food) => (
                  <li key={food.id} className="group flex items-center gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{food.name}</p>
                      <p className="text-xs text-muted-foreground">
                        per {num(Number(food.serving_size))} {food.serving_unit}
                      </p>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <p>{kcal(Number(food.calories_per_serving))} kcal</p>
                      <p className="text-xs text-muted-foreground">
                        {grams(Number(food.protein_per_serving))} protein
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${food.name}`}
                        onClick={() => setEditing(food)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${food.name}`}
                        className="text-muted-foreground"
                        onClick={() => void onDelete(food)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {userId && (creating || editing) && (
        <FoodDialog
          key={editing?.id ?? 'new'}
          userId={userId}
          food={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  )
}

function FoodDialog({
  userId,
  food,
  onClose,
  onSaved,
}: {
  userId: string
  food: Food | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(food?.name ?? '')
  const [servingSize, setServingSize] = useState(num(Number(food?.serving_size ?? 100)))
  const [servingUnit, setServingUnit] = useState(food?.serving_unit ?? 'g')
  const [calories, setCalories] = useState(food ? num(Number(food.calories_per_serving)) : '')
  const [protein, setProtein] = useState(food ? num(Number(food.protein_per_serving)) : '')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const patch: NewFood = {
      name: name.trim(),
      serving_size: Number(servingSize),
      serving_unit: servingUnit,
      calories_per_serving: Number(calories),
      protein_per_serving: Number(protein),
    }
    if (!patch.name || !(patch.serving_size > 0)) {
      toast.error('A name and a serving size above zero are required.')
      return
    }
    setBusy(true)
    try {
      if (food) await updateFood(food.id, patch)
      else await upsertFood(userId, patch)
      toast.success(food ? `Updated ${patch.name}` : `Saved ${patch.name}`)
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save that food')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{food ? 'Edit food' : 'New food'}</DialogTitle>
          <DialogDescription>
            Enter the values for one serving. Logging scales them by quantity.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="food-name">Name</Label>
            <Input
              id="food-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Paneer"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="serving-size">Serving size</Label>
              <Input
                id="serving-size"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serving-unit">Unit</Label>
              <Select value={servingUnit} onValueChange={setServingUnit}>
                <SelectTrigger id="serving-unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="food-calories">Calories (kcal)</Label>
              <Input
                id="food-calories"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="food-protein">Protein (g)</Label>
              <Input
                id="food-protein"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
