import data from '@/data/reference-foods.json'
import type { ReferenceFood } from '@/lib/types'

/**
 * Bundled library of prepared dishes, all figures per 100 g. Read-only — it is
 * a source of suggestions, never a store of the user's data.
 */
export const REFERENCE_FOODS = data as ReferenceFood[]

/** The basis every figure in the library is quoted against. */
export const REFERENCE_SERVING_G = 100

const normalise = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim()

// Precomputed once so keystroke search doesn't re-lowercase 1,014 strings.
const INDEX: Array<{ food: ReferenceFood; haystack: string }> = REFERENCE_FOODS.map((food) => ({
  food,
  haystack: normalise(food.name),
}))

/**
 * Ranked substring search. Exact match first, then prefix, then word-start,
 * then anywhere — so typing "idli" puts "Idli" above "Semolina idli".
 */
export function searchReferenceFoods(query: string, limit = 20): ReferenceFood[] {
  const q = normalise(query)
  if (!q) return []

  const scored: Array<{ food: ReferenceFood; score: number }> = []
  for (const { food, haystack } of INDEX) {
    const at = haystack.indexOf(q)
    if (at === -1) continue

    let score: number
    if (haystack === q) score = 0
    else if (at === 0) score = 1
    else if (haystack[at - 1] === ' ' || haystack[at - 1] === '(') score = 2
    else score = 3

    scored.push({ food, score })
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.food.name.length - b.food.name.length ||
      a.food.name.localeCompare(b.food.name),
  )
  return scored.slice(0, limit).map((s) => s.food)
}

/** Scales a per-100 g reference food to an arbitrary gram quantity. */
export function scaleReference(food: ReferenceFood, grams: number) {
  const factor = grams / REFERENCE_SERVING_G
  const round = (v: number) => Math.round(v * factor * 100) / 100
  return {
    calories: round(food.calories),
    protein: round(food.protein),
    fiber: round(food.fiber),
  }
}
