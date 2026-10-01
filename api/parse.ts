import { GoogleGenAI } from '@google/genai'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifySupabaseUser } from './_lib/auth.js'
import { matchReferenceFood, scaleReference } from './_lib/match.js'

/**
 * Turns one free-text utterance into structured log entries.
 *
 * The model identifies and portions; it never supplies the nutrition numbers
 * for anything in the food library. Those come from the validated per-100 g
 * table, so a confident-looking calorie figure is never invented. Only foods
 * with no library match fall back to the model's own estimate, and those are
 * flagged as such so the review screen can say so.
 *
 * The provider lives entirely behind this file: everything downstream depends
 * on the JSON contract below, not on who produced it.
 */

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const UNITS = ['g', 'ml', 'piece', 'serving', 'scoop', 'cup', 'tbsp'] as const

type Meal = (typeof MEALS)[number]
type Unit = (typeof UNITS)[number]

/**
 * Flash models are the free tier.
 *
 * `gemini-flash-latest` is an alias that tracks the current Flash, so it
 * doesn't retire out from under us the way a pinned version does — a pinned
 * `gemini-2.5-flash` is exactly what broke here. The concrete ids are a
 * fallback for the case where the alias isn't served on this tier, newest
 * first. GEMINI_MODEL overrides the whole chain.
 */
const MODEL_CANDIDATES: string[] = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite']

/** True when the failure is about the model id rather than the request. */
const isModelUnavailable = (message: string) =>
  /not found|does not exist|unsupported|not supported|no longer available|deprecated|404/i.test(
    message,
  )

/**
 * Standard JSON Schema, passed through `responseJsonSchema`.
 *
 * Deliberately conservative about which keywords it uses: nullability is a
 * type array rather than `anyOf`, there is no `additionalProperties`, and no
 * field mixes `enum` with a nullable type. Anything not expressible here is
 * checked in the coerce helpers below — a model can always return something
 * off-spec, whoever makes it.
 */
const SCHEMA = {
  type: 'object',
  required: ['logged_on', 'foods', 'exercises', 'weight_kg', 'energy_level', 'note', 'unparsed'],
  properties: {
    logged_on: {
      type: 'string',
      description: 'The date being logged as yyyy-MM-dd. Resolve relative words against today.',
    },
    foods: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'quantity', 'unit', 'meal', 'est_calories', 'est_protein', 'est_fiber'],
        properties: {
          name: {
            type: 'string',
            description:
              'The dish name as plainly as possible, singular, with no quantity words. Prefer the common Indian dish name where one applies.',
          },
          quantity: { type: 'number', description: 'Amount eaten, in the given unit.' },
          unit: { type: 'string', enum: [...UNITS] },
          meal: { type: 'string', enum: [...MEALS] },
          est_calories: {
            type: 'number',
            description:
              'Your own estimate of total kcal for this portion. Used only when the dish is absent from the reference library.',
          },
          est_protein: {
            type: 'number',
            description: 'Estimated total protein grams for this portion.',
          },
          est_fiber: {
            type: 'number',
            description: 'Estimated total fibre grams for this portion.',
          },
        },
      },
    },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        required: ['exercise', 'weight_kg', 'reps', 'sets'],
        properties: {
          exercise: {
            type: 'string',
            description: 'Exercise name in title case, e.g. "Bench press".',
          },
          weight_kg: {
            type: 'number',
            description: 'Load per rep in kg. Use 0 for bodyweight movements.',
          },
          reps: { type: 'integer', description: 'Reps per set.' },
          sets: { type: 'integer', description: 'Number of sets at this weight.' },
        },
      },
    },
    weight_kg: {
      type: ['number', 'null'],
      description: 'Bodyweight in kg, only if a weigh-in was mentioned.',
    },
    energy_level: {
      type: ['integer', 'null'],
      description:
        'How they felt, 1 drained to 5 strong. Only when they actually said how they felt.',
    },
    note: { type: ['string', 'null'] },
    unparsed: {
      type: 'array',
      items: { type: 'string' },
      description: 'Any part of the input you could not confidently turn into an entry.',
    },
  },
}

function systemPrompt(today: string) {
  return `You convert one short spoken or typed note into structured fitness log entries, and reply with JSON matching the given schema.

Today is ${today}. Resolve relative dates ("yesterday", "this morning") against it; default to today.

Rules:
- Only record what the person actually said. Never invent a meal, a set, or a weigh-in that wasn't mentioned.
- Split multi-item input: "two idlis and a coffee" is two food entries.
- Convert counts to the most natural unit. "two idlis" is quantity 2, unit "piece". Use grams when a weight is stated.
- Gym shorthand: "bench 80 by 8 for 3" means Bench press, 80 kg, 8 reps, 3 sets. "80x8x3" is the same. Bodyweight movements use weight_kg 0.
- Assign a meal from the wording or the time of day it implies; when nothing hints at one, use "snack".
- Set energy_level only if they described how they felt — not from their tone.
- Put anything you could not confidently parse into "unparsed" rather than guessing.
- Your est_* figures are a fallback for dishes missing from the reference library, so make them realistic for the portion described.`
}

type CleanFood = {
  name: string
  quantity: number
  unit: Unit
  meal: Meal
  est_calories: number
  est_protein: number
  est_fiber: number
}

// -------------------------------------------------------------- validation

const num = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : fallback
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

function coerceFoods(input: unknown): CleanFood[] {
  if (!Array.isArray(input)) return []
  const out: CleanFood[] = []
  for (const raw of input as Array<Record<string, unknown>>) {
    const name = str(raw?.name)
    const quantity = num(raw?.quantity, 1)
    if (!name || quantity <= 0) continue
    const unit = str(raw?.unit)
    const meal = str(raw?.meal)
    out.push({
      name,
      quantity,
      unit: (UNITS as readonly string[]).includes(unit) ? (unit as Unit) : 'g',
      meal: (MEALS as readonly string[]).includes(meal) ? (meal as Meal) : 'snack',
      est_calories: num(raw?.est_calories),
      est_protein: num(raw?.est_protein),
      est_fiber: num(raw?.est_fiber),
    })
  }
  return out
}

function coerceExercises(input: unknown) {
  if (!Array.isArray(input)) return []
  const out: Array<{ exercise: string; weight_kg: number; reps: number; sets: number }> = []
  for (const raw of input as Array<Record<string, unknown>>) {
    const exercise = str(raw?.exercise)
    const reps = Math.round(num(raw?.reps))
    const sets = Math.round(num(raw?.sets, 1))
    if (!exercise || reps < 1 || sets < 1) continue
    out.push({ exercise, weight_kg: num(raw?.weight_kg), reps, sets })
  }
  return out
}

function coerceEnergy(input: unknown): number | null {
  if (input == null) return null
  const n = Math.round(num(input, 0))
  return n >= 1 && n <= 5 ? n : null
}

function coerceWeight(input: unknown): number | null {
  if (input == null) return null
  const n = num(input, 0)
  // Outside this range it isn't a bodyweight — more likely a misparsed number.
  return n > 20 && n < 500 ? Math.round(n * 100) / 100 : null
}

// --------------------------------------------------------------- grounding

/** Rough grams for count-based units, so a library match can still be scaled. */
const UNIT_GRAMS: Record<Unit, number> = {
  g: 1,
  ml: 1,
  piece: 60,
  serving: 150,
  scoop: 30,
  cup: 200,
  tbsp: 15,
}

export function groundFoods(foods: CleanFood[]) {
  const round = (v: number) => Math.round(v * 100) / 100

  return foods.map((food) => {
    const grams = food.quantity * UNIT_GRAMS[food.unit]
    const match = matchReferenceFood(food.name)

    if (match) {
      return {
        name: match.food.name,
        spoken_as: food.name,
        quantity: food.quantity,
        unit: food.unit,
        meal: food.meal,
        ...scaleReference(match.food, grams),
        source: 'library' as const,
        confidence: Math.round(match.score * 100) / 100,
        /** The gram basis we scaled by, so the UI can explain non-gram units. */
        grams,
      }
    }

    return {
      name: food.name,
      spoken_as: food.name,
      quantity: food.quantity,
      unit: food.unit,
      meal: food.meal,
      calories: round(food.est_calories),
      protein: round(food.est_protein),
      fiber: round(food.est_fiber),
      source: 'estimated' as const,
      confidence: null,
      grams,
    }
  })
}

// ----------------------------------------------------------------- handler

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Use POST.' })
  }

  // Auth first, so an unauthenticated caller learns nothing about how the
  // server is configured.
  let user: { userId: string } | null
  try {
    user = await verifySupabaseUser(request.headers.authorization)
  } catch (error) {
    return response
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Auth check failed.' })
  }
  if (!user) {
    return response.status(401).json({ error: 'Sign in again — your session was rejected.' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return response.status(500).json({ error: 'Server is missing GEMINI_API_KEY.' })

  const { text, today } = (request.body ?? {}) as { text?: string; today?: string }
  const input = typeof text === 'string' ? text.trim() : ''
  if (!input) return response.status(400).json({ error: 'Nothing to parse.' })
  if (input.length > 2000) return response.status(400).json({ error: 'That note is too long.' })

  const todayKey =
    typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)
      ? today
      : new Date().toISOString().slice(0, 10)

  const ai = new GoogleGenAI({ apiKey })
  const config = {
    systemInstruction: systemPrompt(todayKey),
    responseMimeType: 'application/json',
    responseJsonSchema: SCHEMA,
    // Extraction should be repeatable, not creative.
    temperature: 0,
  }

  let raw: string | undefined
  let servedBy = ''
  const attempts: string[] = []

  try {
    for (const model of MODEL_CANDIDATES) {
      try {
        const result = await ai.models.generateContent({ model, contents: input, config })
        raw = result.text
        servedBy = model
        break
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        attempts.push(`${model}: ${message}`)
        // Only a model-availability problem is worth trying the next
        // candidate for; anything else (bad key, quota) will fail identically.
        if (!isModelUnavailable(message)) throw error
      }
    }

    if (!servedBy) {
      return response.status(502).json({
        error: `No Gemini model was available. Tried — ${attempts.join(' | ')}`,
      })
    }
    if (!raw) return response.status(502).json({ error: 'The parser returned an empty response.' })

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return response.status(502).json({ error: 'The parser returned malformed JSON.' })
    }

    const loggedOn = str(parsed.logged_on)
    return response.status(200).json({
      logged_on: /^\d{4}-\d{2}-\d{2}$/.test(loggedOn) ? loggedOn : todayKey,
      foods: groundFoods(coerceFoods(parsed.foods)),
      exercises: coerceExercises(parsed.exercises),
      weight_kg: coerceWeight(parsed.weight_kg),
      energy_level: coerceEnergy(parsed.energy_level),
      note: str(parsed.note) || null,
      model: servedBy,
      unparsed: Array.isArray(parsed.unparsed)
        ? (parsed.unparsed as unknown[]).map(str).filter(Boolean)
        : [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not parse that.'
    return response.status(500).json({ error: message })
  }
}
