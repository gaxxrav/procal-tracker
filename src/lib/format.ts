import { differenceInYears, format, isAfter, isToday, isYesterday, parseISO } from 'date-fns'

/** Local `yyyy-MM-dd` — never use toISOString(), it shifts across timezones. */
export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function fromDateKey(key: string): Date {
  return parseISO(key)
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/** "Today" / "Yesterday" / "Tuesday, September 22". */
export function longDateLabel(key: string): string {
  const date = fromDateKey(key)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMMM d')
}

export function shortDateLabel(key: string): string {
  return format(fromDateKey(key), 'EEE d MMM')
}

export function round(value: number, places = 0): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

export function kcal(value: number): string {
  return `${Math.round(value).toLocaleString()}`
}

export function grams(value: number): string {
  return `${round(value, 1)}g`
}

/** Trims trailing zeros: 200.00 -> "200", 1.50 -> "1.5". */
export function num(value: number): string {
  return String(round(value, 2))
}

/**
 * Age derived from a `yyyy-MM-dd` birth date, so it never goes stale. Null for
 * a missing or future date.
 */
export function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null
  const born = parseISO(birthDate)
  if (Number.isNaN(born.getTime())) return null
  // A future date inside the current year differences to 0, not a negative, so
  // reject it explicitly rather than reporting someone as age 0.
  if (isAfter(born, new Date())) return null
  return differenceInYears(new Date(), born)
}

export type Bmi = { value: number; category: string }

/**
 * BMI is always derived from current height and weight, never stored — so it
 * can't go stale when either one changes. Null until both are known.
 */
export function bmi(heightCm: number | null, weightKg: number | null): Bmi | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null
  const metres = heightCm / 100
  const value = round(weightKg / (metres * metres), 1)
  const category =
    value < 18.5
      ? 'Underweight'
      : value < 25
        ? 'Normal'
        : value < 30
          ? 'Overweight'
          : 'Obese'
  return { value, category }
}

/** Total load moved: weight x reps x sets. */
export function volume(weightKg: number, reps: number, sets: number): number {
  return round(weightKg * reps * sets, 1)
}
