import { supabase } from '@/lib/supabase'
import type { Meal } from '@/lib/types'

/** A food the parser produced, already grounded against the library. */
export type ParsedFood = {
  name: string
  /** What the user actually said, when it differs from the matched name. */
  spoken_as: string
  quantity: number
  unit: string
  meal: Meal
  calories: number
  protein: number
  fiber: number
  /** `library` = numbers from the validated table. `estimated` = the model's guess. */
  source: 'library' | 'estimated'
  confidence: number | null
  grams: number
}

export type ParsedExercise = {
  exercise: string
  weight_kg: number
  reps: number
  sets: number
}

export type ParsedLog = {
  logged_on: string
  foods: ParsedFood[]
  exercises: ParsedExercise[]
  weight_kg: number | null
  energy_level: number | null
  note: string | null
  unparsed: string[]
}

export function isEmptyParse(parsed: ParsedLog): boolean {
  return (
    parsed.foods.length === 0 &&
    parsed.exercises.length === 0 &&
    parsed.weight_kg == null &&
    parsed.energy_level == null
  )
}

/**
 * Sends one utterance to the server-side parser. The Anthropic key never
 * reaches the browser, so this has to round-trip through /api/parse, which
 * verifies the Supabase session before spending anything.
 */
export async function parseQuickLog(text: string, todayKey: string): Promise<ParsedLog> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Your session expired — sign in again.')

  const response = await fetch('/api/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text, today: todayKey }),
  })

  if (!response.ok) {
    let message = `Parser failed (${response.status}).`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // Non-JSON error body (e.g. a proxy error page) — keep the status message.
    }
    throw new Error(message)
  }

  return (await response.json()) as ParsedLog
}

// ------------------------------------------------------------ speech input

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

type SpeechWindow = typeof window & {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}

function speechConstructor() {
  const w = window as SpeechWindow
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/**
 * Web Speech is reliable on desktop Chrome and absent or flaky on iOS Safari.
 * On iPhone the keyboard's own dictation key covers this for free, so the
 * button is simply hidden rather than offered and broken.
 */
export const speechSupported = (): boolean => Boolean(speechConstructor())

export function startDictation(
  onText: (transcript: string) => void,
  onError: (message: string) => void,
  onEnd: () => void,
): () => void {
  const Ctor = speechConstructor()
  if (!Ctor) {
    onError('Dictation is not available in this browser.')
    onEnd()
    return () => {}
  }

  const recognition = new Ctor()
  recognition.lang = 'en-IN'
  recognition.continuous = false
  recognition.interimResults = false

  recognition.onresult = (event) => {
    const chunks: string[] = []
    for (let i = 0; i < event.results.length; i += 1) {
      const alternative = event.results[i]?.[0]
      if (alternative?.transcript) chunks.push(alternative.transcript)
    }
    if (chunks.length) onText(chunks.join(' ').trim())
  }
  recognition.onerror = (event) => {
    onError(
      event.error === 'not-allowed'
        ? 'Microphone permission was denied.'
        : 'Dictation stopped unexpectedly.',
    )
  }
  recognition.onend = onEnd

  recognition.start()
  return () => recognition.stop()
}
