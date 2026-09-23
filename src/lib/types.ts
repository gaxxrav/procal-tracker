/** Each metric owns a hue app-wide: meters, stat tiles and charts. */
export type Metric = 'calories' | 'protein' | 'volume' | 'bodyweight'

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type Meal = (typeof MEALS)[number]

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export const UNITS = ['g', 'ml', 'piece', 'serving', 'scoop', 'cup', 'tbsp'] as const
export type Unit = (typeof UNITS)[number]

export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const
export type Gender = (typeof GENDERS)[number]

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
}

/** 1 = wiped out, 5 = flying. Recorded once per day, not per exercise. */
export const ENERGY_LEVELS = [1, 2, 3, 4, 5] as const

export const ENERGY_LABELS: Record<number, string> = {
  1: 'Drained',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Strong',
}

export type Profile = {
  id: string
  display_name: string | null
  calorie_target: number
  protein_target: number
  height_cm: number | null
  weight_kg: number | null
  /** `yyyy-MM-dd`. Age is derived from this, never stored. */
  birth_date: string | null
  gender: Gender | null
  created_at: string
  updated_at: string
}

export type WorkoutEntry = {
  id: string
  user_id: string
  /** `yyyy-MM-dd` */
  logged_on: string
  exercise: string
  /** 0 for bodyweight movements. */
  weight_kg: number
  reps: number
  sets: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type Food = {
  id: string
  user_id: string
  name: string
  serving_size: number
  serving_unit: string
  calories_per_serving: number
  protein_per_serving: number
  created_at: string
  updated_at: string
}

export type FoodEntry = {
  id: string
  user_id: string
  food_id: string | null
  /** `yyyy-MM-dd` */
  logged_on: string
  meal: Meal
  food_name: string
  quantity: number
  unit: string
  /** Total for this entry, not per serving. */
  calories: number
  protein: number
  created_at: string
  updated_at: string
}

export type DailyLog = {
  id: string
  user_id: string
  logged_on: string
  calorie_target: number | null
  protein_target: number | null
  weight_kg: number | null
  /** 1–5, optional. See ENERGY_LABELS. */
  energy_level: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type DailyTotals = {
  user_id: string
  logged_on: string
  calories: number
  protein: number
  entry_count: number
}

export type DailyWorkoutTotals = {
  user_id: string
  logged_on: string
  volume: number
  total_sets: number
  total_reps: number
  exercises: number
}
