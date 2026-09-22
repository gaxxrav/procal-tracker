import { format, isToday, isYesterday, parseISO } from 'date-fns'

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
