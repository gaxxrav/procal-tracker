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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createEntry, upsertFood, type NewEntry } from '@/lib/api'
import { grams, kcal, num, round } from '@/lib/format'
import { MEAL_LABELS, MEALS, UNITS, type Food, type Meal } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Loader2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  dateKey: string
  defaultMeal: Meal
  foods: Food[]
  onSaved: () => void
  /** Called when a new saved food is created, so the library can refresh. */
  onFoodCreated: () => void
}

export function AddFoodDialog({
  open,
  onOpenChange,
  userId,
  dateKey,
  defaultMeal,
  foods,
  onSaved,
  onFoodCreated,
}: Props) {
  const [meal, setMeal] = useState<Meal>(defaultMeal)
  const [busy, setBusy] = useState(false)

  // Saved-food tab
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [savedQty, setSavedQty] = useState('')

  // Custom tab
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState<string>('g')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [alsoSave, setAlsoSave] = useState(false)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods
    return list.slice(0, 8)
  }, [foods, query])

  // Saved foods store per-serving values; scale them to the logged quantity.
  const scaled = useMemo(() => {
    if (!selected) return null
    const quantity = Number(savedQty)
    if (!Number.isFinite(quantity) || quantity <= 0) return null
    const factor = quantity / selected.serving_size
    return {
      quantity,
      calories: round(selected.calories_per_serving * factor, 2),
      protein: round(selected.protein_per_serving * factor, 2),
    }
  }, [selected, savedQty])

  function reset() {
    setQuery('')
    setSelected(null)
    setSavedQty('')
    setName('')
    setQty('1')
    setUnit('g')
    setCalories('')
    setProtein('')
    setAlsoSave(false)
  }

  function close() {
    onOpenChange(false)
    reset()
  }

  async function submit(entry: NewEntry, saveAsFood?: { serving_size: number; unit: string }) {
    setBusy(true)
    try {
      await createEntry(userId, entry)
      if (saveAsFood) {
        await upsertFood(userId, {
          name: entry.food_name,
          serving_size: saveAsFood.serving_size,
          serving_unit: saveAsFood.unit,
          calories_per_serving: entry.calories,
          protein_per_serving: entry.protein,
        })
        onFoodCreated()
      }
      toast.success(`Added ${entry.food_name}`)
      onSaved()
      close()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add food')
    } finally {
      setBusy(false)
    }
  }

  function submitSaved(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || !scaled) return
    void submit({
      logged_on: dateKey,
      meal,
      food_name: selected.name,
      quantity: scaled.quantity,
      unit: selected.serving_unit,
      calories: scaled.calories,
      protein: scaled.protein,
      food_id: selected.id,
    })
  }

  function submitCustom(event: React.FormEvent) {
    event.preventDefault()
    const quantity = Number(qty)
    const cal = Number(calories)
    const pro = Number(protein)
    if (!name.trim() || !(quantity > 0) || !(cal >= 0) || !(pro >= 0)) {
      toast.error('Fill in a name, quantity, calories and protein.')
      return
    }
    void submit(
      {
        logged_on: dateKey,
        meal,
        food_name: name.trim(),
        quantity,
        unit,
        calories: cal,
        protein: pro,
      },
      alsoSave ? { serving_size: quantity, unit } : undefined,
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add food</DialogTitle>
          <DialogDescription>Log an item against a meal for this day.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="meal">Meal</Label>
          <Select value={meal} onValueChange={(v) => setMeal(v as Meal)}>
            <SelectTrigger id="meal" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEALS.map((m) => (
                <SelectItem key={m} value={m}>
                  {MEAL_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue={foods.length ? 'saved' : 'custom'}>
          <TabsList className="w-full">
            <TabsTrigger value="saved" className="flex-1">
              My foods
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex-1">
              One-off
            </TabsTrigger>
          </TabsList>

          {/* ------------------------------------------------- saved foods */}
          <TabsContent value="saved" className="space-y-3 pt-3">
            <form onSubmit={submitSaved} className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search your foods"
                  className="pl-8"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {foods.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No saved foods yet. Log a one-off and tick “Save to my foods”.
                </p>
              ) : (
                <ul className="max-h-52 space-y-1 overflow-y-auto">
                  {matches.map((food) => {
                    const active = selected?.id === food.id
                    return (
                      <li key={food.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(food)
                            setSavedQty(num(food.serving_size))
                          }}
                          className={cn(
                            'flex w-full items-baseline justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                            active ? 'bg-muted' : 'hover:bg-muted/60',
                          )}
                        >
                          <span className="truncate font-medium">{food.name}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {kcal(food.calories_per_serving)} kcal ·{' '}
                            {grams(food.protein_per_serving)} / {num(food.serving_size)}
                            {food.serving_unit}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                  {matches.length === 0 && (
                    <li className="py-6 text-center text-sm text-muted-foreground">
                      Nothing matches “{query}”.
                    </li>
                  )}
                </ul>
              )}

              {selected && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-2">
                    <Label htmlFor="saved-qty">Quantity ({selected.serving_unit})</Label>
                    <Input
                      id="saved-qty"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={savedQty}
                      onChange={(e) => setSavedQty(e.target.value)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {scaled ? (
                      <>
                        <span className="font-medium text-foreground">
                          {kcal(scaled.calories)} kcal
                        </span>{' '}
                        ·{' '}
                        <span className="font-medium text-foreground">
                          {grams(scaled.protein)} protein
                        </span>
                      </>
                    ) : (
                      'Enter a quantity.'
                    )}
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button type="submit" size="lg" disabled={busy || !scaled} className="w-full">
                  {busy && <Loader2 className="animate-spin" />}
                  Add
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* -------------------------------------------------- custom food */}
          <TabsContent value="custom" className="space-y-3 pt-3">
            <form onSubmit={submitCustom} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="name">Food</Label>
                <Input
                  id="name"
                  placeholder="Paneer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="qty">Quantity</Label>
                  <Input
                    id="qty"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger id="unit" className="w-full">
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
                  <Label htmlFor="calories">Calories (kcal)</Label>
                  <Input
                    id="calories"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="530"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="protein">Protein (g)</Label>
                  <Input
                    id="protein"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="36"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="also-save"
                  checked={alsoSave}
                  onCheckedChange={(v) => setAlsoSave(v === true)}
                />
                <Label htmlFor="also-save" className="font-normal">
                  Save to my foods for next time
                </Label>
              </div>

              <DialogFooter>
                <Button type="submit" size="lg" disabled={busy} className="w-full">
                  {busy && <Loader2 className="animate-spin" />}
                  Add
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
