import { REFERENCE_FOOD_ROWS, type ReferenceFoodRow } from '../../src/data/reference-foods'

type ReferenceFood = ReferenceFoodRow

const FOODS: ReferenceFood[] = REFERENCE_FOOD_ROWS
const REFERENCE_SERVING_G = 100

const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical transliterations
    .replace(/[^a-z0-9/, ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Words that carry no identifying signal. Number words are included as
 * defence in depth — the model is told to strip quantities, but "two idlis"
 * shouldn't fail to match just because it slips through.
 */
const STOP_WORDS = new Set([
  // 'hot' and 'cold' are deliberately NOT here: they distinguish real dishes
  // (hot tea vs cold coffee), and stripping them let "filter coffee" match
  // "Cold coffee (with cream)".
  'a', 'an', 'the', 'of', 'with', 'and', 'in', 'on', 'plain', 'fresh',
  'some', 'my', 'homemade', 'home', 'made', 'cooked', 'raw', 'piece',
  'pieces', 'serving', 'servings', 'glass', 'cup', 'bowl', 'plate',
  'one', 'two', 'three', 'four', 'five', 'six', 'half', 'quarter',
])

/** Crude singulariser — enough for "idlis" -> "idli", "rotis" -> "roti". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function tokenise(value: string): string[] {
  return normalise(value)
    .replace(/[/,]/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map(stem)
}

/**
 * A library name like "Chapati/Roti" or "Rice flakes (Chiwda/Aval)" lists
 * several names for one dish. Each is a full alias the user might say, so
 * they're scored separately instead of as one bag of words.
 */
function aliases(name: string): string[] {
  const withoutParens = normalise(name).replace(/[,]/g, '/')
  return withoutParens
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
}

const INDEX = FOODS.map((food) => ({
  food,
  aliases: aliases(food.name).map((alias) => {
    const tokens = tokenise(alias)
    return {
      text: alias,
      tokens: new Set(tokens),
      /** English puts the head noun last: "chicken stew" is a stew. */
      head: tokens.at(-1) ?? '',
    }
  }),
}))

export type Match = {
  food: ReferenceFood
  /** 0–1. Higher is a better match. */
  score: number
}

/** Harmonic mean of precision and recall over shared tokens. */
function tokenF1(query: Set<string>, candidate: Set<string>): number {
  if (query.size === 0 || candidate.size === 0) return 0
  let shared = 0
  for (const t of query) if (candidate.has(t)) shared += 1
  if (shared === 0) return 0
  const precision = shared / query.size
  const recall = shared / candidate.size
  return (2 * precision * recall) / (precision + recall)
}

/**
 * A single shared token between two multi-word names is a coincidence more
 * often than a match — "filter coffee" vs "Coffee biscuit" scores 0.5 here,
 * and a biscuit is not a coffee. Only a strong overlap counts.
 */
const MIN_TOKEN_F1 = 0.55

/** Scores within this of the best count as tied. */
const TIE_EPSILON = 0.02

/** At or above this, the match is strong enough to win despite ties. */
const UNAMBIGUOUS_SCORE = 0.9

/**
 * Finds the best library entry for a free-text dish name. Deliberately
 * conservative: a weak match returns null so the caller falls back to the
 * model's estimate rather than attaching confident-looking wrong numbers.
 */
export function matchReferenceFood(query: string): Match | null {
  const q = normalise(query).replace(/[/,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!q) return null
  const qTokens = new Set(tokenise(query))
  if (qTokens.size === 0) return null

  let best: Match | null = null
  // How many distinct dishes tie at the top score. A bare word like "rice"
  // fits dozens of dishes equally well, and picking one is a coin flip.
  let tiedAtBest = 0

  for (const entry of INDEX) {
    for (const alias of entry.aliases) {
      let score = 0

      if (alias.text === q) {
        score = 1
      } else {
        // Any inexact match must share the dish's head noun. Without this,
        // "chicken" matches "Chicken stew" and picks up a stew's numbers.
        if (!alias.head || !qTokens.has(alias.head)) continue

        if (alias.text.startsWith(`${q} `)) {
          score = 0.9 * (q.length / alias.text.length) + 0.1
        } else {
          const f1 = tokenF1(qTokens, alias.tokens)
          if (f1 < MIN_TOKEN_F1) continue
          score = 0.85 * f1
        }
      }

      if (!best || score > best.score - TIE_EPSILON) {
        if (!best || score > best.score) {
          if (best && score > best.score + TIE_EPSILON) tiedAtBest = 1
          else tiedAtBest += 1
          best = { food: entry.food, score }
        } else {
          tiedAtBest += 1
        }
      }
    }
  }

  if (!best || best.score < 0.4) return null
  // An exact name is unambiguous by definition; anything softer has to win
  // outright, or we fall back to an estimate and say so.
  if (best.score < UNAMBIGUOUS_SCORE && tiedAtBest > 1) return null
  return best
}

/** Scales a per-100 g library entry to a gram quantity. */
export function scaleReference(food: ReferenceFood, grams: number) {
  const factor = grams / REFERENCE_SERVING_G
  const round = (v: number) => Math.round(v * factor * 100) / 100
  return {
    calories: round(food.calories),
    protein: round(food.protein),
    fiber: round(food.fiber),
  }
}

export { REFERENCE_SERVING_G }
