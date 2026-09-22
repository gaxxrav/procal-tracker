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

export type Profile = {
  id: string
  display_name: string | null
  calorie_target: number
  protein_target: number
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
