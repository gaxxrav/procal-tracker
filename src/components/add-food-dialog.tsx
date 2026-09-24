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
import {
  REFERENCE_SERVING_G,
  scaleReference,
  searchReferenceFoods,
} from '@/lib/reference-foods'
import { MEAL_LABELS, MEALS, UNITS, type Food, type Meal, type ReferenceFood } from '@/lib/types'
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
  onFoodCreated: () => void
}

/** A saved food and a library food, reduced to what the picker needs. */
type Pick_ =
  | { source: 'saved'; food: Food }
  | { source: 'library'; food: ReferenceFood }

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

  // Search tab
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Pick_ | null>(null)
  const [qty, setQty] = useState('')

  // One-off tab
  const [name, setName] = useState('')
  const [customQty, setCustomQty] = useState('1')
  const [unit, setUnit] = useState<string>('g')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [fiber, setFiber] = useState('')
  const [alsoSave, setAlsoSave] = useState(false)

  const savedMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods
    return list.slice(0, 6)
  }, [foods, query])

  // Your own foods always rank above the library; the library only fills in
  // once you've typed something.
  const libraryMatches = useMemo(() => {
    if (!query.trim()) return []
    const ownNames = new Set(foods.map((f) => f.name.toLowerCase()))
    return searchReferenceFoods(query, 30)
      .filter((f) => !ownNames.has(f.name.toLowerCase()))
      .slice(0, 12)
  }, [query, foods])

  const scaled = useMemo(() => {
    if (!selected) return null
    const quantity = Number(qty)
    if (!Number.isFinite(quantity) || quantity <= 0) return null

    if (selected.source === 'library') {
      return { quantity, unit: 'g', ...scaleReference(selected.food, quantity) }
    }
    const f = selected.food
    const factor = quantity / Number(f.serving_size)
    return {
      quantity,
      unit: f.serving_unit,
      calories: round(Number(f.calories_per_serving) * factor, 2),
      protein: round(Number(f.protein_per_serving) * factor, 2),
      fiber: round(Number(f.fiber_per_serving ?? 0) * factor, 2),
    }
  }, [selected, qty])

  function reset() {
    setQuery('')
    setSelected(null)
    setQty('')
    setName('')
    setCustomQty('1')
    setUnit('g')
    setCalories('')
    setProtein('')
    setFiber('')
    setAlsoSave(false)
  }

  function close() {
    onOpenChange(false)
    reset()
  }

  function choose(pick: Pick_) {
    setSelected(pick)
    setQty(
      pick.source === 'library'
        ? String(REFERENCE_SERVING_G)
        : num(Number(pick.food.serving_size)),
    )
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
          fiber_per_serving: entry.fiber,
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

  function submitSelected(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || !scaled) return
    void submit({
      logged_on: dateKey,
      meal,
      food_name: selected.food.name,
      quantity: scaled.quantity,
      unit: scaled.unit,
      calories: scaled.calories,
      protein: scaled.protein,
      fiber: scaled.fiber,
      food_id: selected.source === 'saved' ? selected.food.id : null,
    })
  }

  function submitCustom(event: React.FormEvent) {
    event.preventDefault()
    const quantity = Number(customQty)
    const cal = Number(calories)
    const pro = Number(protein)
    const fib = fiber.trim() === '' ? 0 : Number(fiber)
    if (!name.trim() || !(quantity > 0) || !(cal >= 0) || !(pro >= 0) || !(fib >= 0)) {
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
        fiber: fib,
      },
      alsoSave ? { serving_size: quantity, unit } : undefined,
    )
  }

  const nothingFound = query.trim() && savedMatches.length === 0 && libraryMatches.length === 0

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

        <Tabs defaultValue="search">
          <TabsList className="w-full">
            <TabsTrigger value="search" className="flex-1">
              Search
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex-1">
              One-off
            </TabsTrigger>
          </TabsList>

          {/* ------------------------------------------------------ search */}
          <TabsContent value="search" className="space-y-3 pt-3">
            <form onSubmit={submitSelected} className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search your foods and the library"
                  className="pl-8"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelected(null)
                  }}
                  autoComplete="off"
                />
              </div>

              <div className="max-h-56 space-y-3 overflow-y-auto">
                {savedMatches.length > 0 && (
                  <Group label="My foods">
                    {savedMatches.map((food) => (
                      <Row
                        key={food.id}
                        active={selected?.source === 'saved' && selected.food.id === food.id}
                        name={food.name}
                        detail={`${kcal(Number(food.calories_per_serving))} kcal · ${grams(
                          Number(food.protein_per_serving),
                        )} P / ${num(Number(food.serving_size))}${food.serving_unit}`}
                        onSelect={() => choose({ source: 'saved', food })}
                      />
                    ))}
                  </Group>
                )}

                {libraryMatches.length > 0 && (
                  <Group label={`Library · per ${REFERENCE_SERVING_G} g`}>
                    {libraryMatches.map((food) => (
                      <Row
                        key={food.name}
                        active={selected?.source === 'library' && selected.food.name === food.name}
                        name={food.name}
                        detail={`${kcal(food.calories)} kcal · ${grams(food.protein)} P · ${grams(
                          food.fiber,
                        )} fib`}
                        onSelect={() => choose({ source: 'library', food })}
                      />
                    ))}
                  </Group>
                )}

                {nothingFound && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nothing matches “{query}”. Use the One-off tab.
                  </p>
                )}
                {!query.trim() && foods.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Start typing to search 1,000+ dishes.
                  </p>
                )}
              </div>

              {selected && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-2">
                    <Label htmlFor="qty">
                      Quantity ({selected.source === 'library' ? 'g' : selected.food.serving_unit})
                    </Label>
                    <Input
                      id="qty"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      autoFocus
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
                        </span>{' '}
                        · <span className="font-medium text-foreground">{grams(scaled.fiber)} fibre</span>
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

          {/* ------------------------------------------------------ one-off */}
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
                  <Label htmlFor="custom-qty">Quantity</Label>
                  <Input
                    id="custom-qty"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
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

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="calories">Calories</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="fiber">Fibre (g)</Label>
                  <Input
                    id="fiber"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={fiber}
                    onChange={(e) => setFiber(e.target.value)}
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
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
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

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  )
}

function Row({
  active,
  name,
  detail,
  onSelect,
}: {
  active: boolean
  name: string
  detail: string
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-left transition-colors',
          active ? 'bg-muted' : 'hover:bg-muted/60',
        )}
      >
        <span className="w-full truncate text-sm font-medium">{name}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{detail}</span>
      </button>
    </li>
  )
}
