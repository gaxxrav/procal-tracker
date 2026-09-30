import Anthropic from '@anthropic-ai/sdk'
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
 */

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const UNITS = ['g', 'ml', 'piece', 'serving', 'scoop', 'cup', 'tbsp'] as const

const nullable = (type: string) => ({ anyOf: [{ type }, { type: 'null' }] })

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['logged_on', 'foods', 'exercises', 'weight_kg', 'energy_level', 'note', 'unparsed'],
  properties: {
    logged_on: {
      type: 'string',
      description: 'The date being logged, yyyy-MM-dd. Resolve relative words against today.',
    },
    foods: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit', 'meal', 'est_calories', 'est_protein', 'est_fiber'],
        properties: {
          name: {
            type: 'string',
            description:
              'The dish name as plainly as possible, singular, no quantity words. Prefer the common Indian dish name if one applies.',
          },
          quantity: { type: 'number', description: 'Amount eaten in the given unit.' },
          unit: { type: 'string', enum: [...UNITS] },
          meal: { type: 'string', enum: [...MEALS] },
          est_calories: {
            type: 'number',
            description:
              'Your own estimate of total kcal for this portion. Used only if the dish is absent from the reference library.',
          },
          est_protein: { type: 'number', description: 'Your estimate of total protein grams for this portion.' },
          est_fiber: { type: 'number', description: 'Your estimate of total fibre grams for this portion.' },
        },
      },
    },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['exercise', 'weight_kg', 'reps', 'sets'],
        properties: {
          exercise: { type: 'string', description: 'Exercise name, title case, e.g. "Bench press".' },
          weight_kg: { type: 'number', description: 'Load per rep in kg. Use 0 for bodyweight movements.' },
          reps: { type: 'integer', description: 'Reps per set.' },
          sets: { type: 'integer', description: 'Number of sets at this weight.' },
        },
      },
    },
    weight_kg: nullable('number'),
    energy_level: {
      anyOf: [{ type: 'integer', enum: [1, 2, 3, 4, 5] }, { type: 'null' }],
      description: '1 drained, 3 okay, 5 strong. Only when the person actually says how they felt.',
    },
    note: nullable('string'),
    unparsed: {
      type: 'array',
      items: { type: 'string' },
      description: 'Any part of the input you could not confidently turn into an entry.',
    },
  },
} as const

function systemPrompt(today: string) {
  return `You convert one short spoken or typed note into structured fitness log entries.

Today is ${today}. Resolve relative dates ("yesterday", "this morning") against it; default to today.

Rules:
- Only record what the person actually said. Never invent a meal, a set, or a weigh-in that wasn't mentioned.
- Split multi-item input: "two idlis and a coffee" is two food entries.
- Convert counts to the most natural unit. "two idlis" is quantity 2, unit "piece". Grams when a weight is stated.
- Gym shorthand: "bench 80 by 8 for 3" means Bench press, 80 kg, 8 reps, 3 sets. "80x8x3" is the same. Bodyweight movements use weight_kg 0.
- Assign a meal from the wording or the time of day it implies; when nothing hints at one, use "snack".
- Set energy_level only if they described how they felt, not from tone.
- Put anything you couldn't confidently parse into "unparsed" rather than guessing.
- Your est_* figures are a fallback for dishes missing from the reference library, so make them realistic for the portion described.`
}

type ParsedFood = {
  name: string
  quantity: number
  unit: string
  meal: string
  est_calories: number
  est_protein: number
  est_fiber: number
}

type ParsedPayload = {
  logged_on: string
  foods: ParsedFood[]
  exercises: Array<{ exercise: string; weight_kg: number; reps: number; sets: number }>
  weight_kg: number | null
  energy_level: number | null
  note: string | null
  unparsed: string[]
}

/** Rough grams for count-based units, so a library match can still be scaled. */
const UNIT_GRAMS: Record<string, number> = {
  g: 1,
  ml: 1,
  piece: 60,
  serving: 150,
  scoop: 30,
  cup: 200,
  tbsp: 15,
}

export function groundFoods(foods: ParsedFood[]) {
  return foods.map((food) => {
    const grams = food.quantity * (UNIT_GRAMS[food.unit] ?? 100)
    const match = matchReferenceFood(food.name)

    if (match) {
      const scaled = scaleReference(match.food, grams)
      return {
        name: match.food.name,
        spoken_as: food.name,
        quantity: food.quantity,
        unit: food.unit,
        meal: food.meal,
        ...scaled,
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
      calories: Math.round(food.est_calories * 100) / 100,
      protein: Math.round(food.est_protein * 100) / 100,
      fiber: Math.round(food.est_fiber * 100) / 100,
      source: 'estimated' as const,
      confidence: null,
      grams,
    }
  })
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Use POST.' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return response.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY.' })
  }

  let user: { userId: string } | null
  try {
    user = await verifySupabaseUser(request.headers.authorization)
  } catch (error) {
    return response
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Auth check failed.' })
  }
  if (!user) return response.status(401).json({ error: 'Sign in again — your session was rejected.' })

  const { text, today } = (request.body ?? {}) as { text?: string; today?: string }
  const input = typeof text === 'string' ? text.trim() : ''
  if (!input) return response.status(400).json({ error: 'Nothing to parse.' })
  if (input.length > 2000) return response.status(400).json({ error: 'That note is too long.' })

  const todayKey =
    typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)
      ? today
      : new Date().toISOString().slice(0, 10)

  const client = new Anthropic()

  try {
    const message = await client.messages.create({
      // Extraction, not reasoning — and the round trip sits in front of a
      // person waiting to log a meal, so the cheapest capable model wins.
      // Note: `output_config.effort` errors on Haiku 4.5, so it is absent
      // here deliberately; structured outputs are supported.
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      output_config: {
        format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> },
      },
      system: systemPrompt(todayKey),
      messages: [{ role: 'user', content: input }],
    })

    if (message.stop_reason === 'refusal') {
      return response.status(422).json({ error: 'That input was declined. Try rephrasing it.' })
    }

    const textBlock = message.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return response.status(502).json({ error: 'The parser returned nothing usable.' })
    }

    const parsed = JSON.parse(textBlock.text) as ParsedPayload

    return response.status(200).json({
      logged_on: /^\d{4}-\d{2}-\d{2}$/.test(parsed.logged_on) ? parsed.logged_on : todayKey,
      foods: groundFoods(parsed.foods ?? []),
      exercises: parsed.exercises ?? [],
      weight_kg: parsed.weight_kg,
      energy_level: parsed.energy_level,
      note: parsed.note,
      unparsed: parsed.unparsed ?? [],
    })
  } catch (error) {
    const status =
      error instanceof Anthropic.RateLimitError
        ? 429
        : error instanceof Anthropic.APIError
          ? 502
          : 500
    return response.status(status).json({
      error: error instanceof Error ? error.message : 'Could not parse that.',
    })
  }
}
