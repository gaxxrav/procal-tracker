import { supabase } from '@/lib/supabase'
import type {
  DailyLog,
  DailyTotals,
  DailyWorkoutTotals,
  Food,
  FoodEntry,
  Meal,
  Profile,
  WorkoutEntry,
} from '@/lib/types'

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

// ------------------------------------------------------------------ profile

export async function updateProfile(
  userId: string,
  patch: Partial<
    Pick<
      Profile,
      | 'display_name'
      | 'calorie_target'
      | 'protein_target'
      | 'fiber_target'
      | 'height_cm'
      | 'weight_kg'
      | 'birth_date'
      | 'gender'
    >
  >,
): Promise<Profile> {
  return unwrap(
    await supabase.from('profiles').update(patch).eq('id', userId).select('*').single(),
  )
}

// ------------------------------------------------------------- food entries

export async function listEntries(userId: string, dateKey: string): Promise<FoodEntry[]> {
  return unwrap(
    await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('logged_on', dateKey)
      .order('created_at', { ascending: true }),
  )
}

export type NewEntry = {
  logged_on: string
  meal: Meal
  food_name: string
  quantity: number
  unit: string
  calories: number
  protein: number
  fiber: number
  food_id?: string | null
}

export async function createEntry(userId: string, entry: NewEntry): Promise<FoodEntry> {
  return unwrap(
    await supabase
      .from('food_entries')
      .insert({ ...entry, user_id: userId })
      .select('*')
      .single(),
  )
}

export async function updateEntry(id: string, patch: Partial<NewEntry>): Promise<FoodEntry> {
  return unwrap(await supabase.from('food_entries').update(patch).eq('id', id).select('*').single())
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('food_entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// -------------------------------------------------------------- saved foods

export async function listFoods(userId: string): Promise<Food[]> {
  return unwrap(
    await supabase.from('foods').select('*').eq('user_id', userId).order('name', { ascending: true }),
  )
}

export type NewFood = {
  name: string
  serving_size: number
  serving_unit: string
  calories_per_serving: number
  protein_per_serving: number
  fiber_per_serving: number
}

export async function upsertFood(userId: string, food: NewFood): Promise<Food> {
  return unwrap(
    await supabase
      .from('foods')
      .upsert({ ...food, user_id: userId }, { onConflict: 'user_id,name' })
      .select('*')
      .single(),
  )
}

export async function updateFood(id: string, patch: Partial<NewFood>): Promise<Food> {
  return unwrap(await supabase.from('foods').update(patch).eq('id', id).select('*').single())
}

export async function deleteFood(id: string): Promise<void> {
  const { error } = await supabase.from('foods').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// --------------------------------------------------------------- daily logs

export async function getDailyLog(userId: string, dateKey: string): Promise<DailyLog | null> {
  return unwrap(
    await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('logged_on', dateKey)
      .maybeSingle(),
  )
}

export async function upsertDailyLog(
  userId: string,
  dateKey: string,
  patch: Partial<
    Pick<
      DailyLog,
      'calorie_target' | 'protein_target' | 'fiber_target' | 'weight_kg' | 'energy_level' | 'notes'
    >
  >,
): Promise<DailyLog> {
  return unwrap(
    await supabase
      .from('daily_logs')
      .upsert({ ...patch, user_id: userId, logged_on: dateKey }, { onConflict: 'user_id,logged_on' })
      .select('*')
      .single(),
  )
}

// ----------------------------------------------------------------- workouts

export async function listWorkoutEntries(
  userId: string,
  dateKey: string,
): Promise<WorkoutEntry[]> {
  return unwrap(
    await supabase
      .from('workout_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('logged_on', dateKey)
      .order('created_at', { ascending: true }),
  )
}

export type NewWorkoutEntry = {
  logged_on: string
  exercise: string
  weight_kg: number
  reps: number
  sets: number
  notes?: string | null
}

export async function createWorkoutEntry(
  userId: string,
  entry: NewWorkoutEntry,
): Promise<WorkoutEntry> {
  return unwrap(
    await supabase
      .from('workout_entries')
      .insert({ ...entry, user_id: userId })
      .select('*')
      .single(),
  )
}

export async function updateWorkoutEntry(
  id: string,
  patch: Partial<NewWorkoutEntry>,
): Promise<WorkoutEntry> {
  return unwrap(
    await supabase.from('workout_entries').update(patch).eq('id', id).select('*').single(),
  )
}

export async function deleteWorkoutEntry(id: string): Promise<void> {
  const { error } = await supabase.from('workout_entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Distinct exercise names this user has logged before, most recent first.
 * Backs the name autocomplete, so there's no separate exercise library to keep
 * in sync.
 */
export async function listExerciseNames(userId: string): Promise<string[]> {
  const rows = unwrap<Array<Pick<WorkoutEntry, 'exercise'>>>(
    await supabase
      .from('workout_entries')
      .select('exercise')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(400),
  )
  return [...new Set(rows.map((r) => r.exercise))]
}

// ------------------------------------------------------------------ history

export async function listDailyTotals(
  userId: string,
  fromKey: string,
  toKey: string,
): Promise<DailyTotals[]> {
  return unwrap(
    await supabase
      .from('daily_totals')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_on', fromKey)
      .lte('logged_on', toKey)
      .order('logged_on', { ascending: true }),
  )
}

export async function listDailyWorkoutTotals(
  userId: string,
  fromKey: string,
  toKey: string,
): Promise<DailyWorkoutTotals[]> {
  return unwrap(
    await supabase
      .from('daily_workout_totals')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_on', fromKey)
      .lte('logged_on', toKey)
      .order('logged_on', { ascending: true }),
  )
}

/**
 * Records a weigh-in for a day and mirrors it onto the profile as the current
 * weight, so BMI follows the latest weigh-in without a second source of truth.
 */
export async function recordWeighIn(
  userId: string,
  dateKey: string,
  weightKg: number | null,
): Promise<DailyLog> {
  const log = await upsertDailyLog(userId, dateKey, { weight_kg: weightKg })
  if (weightKg !== null) await updateProfile(userId, { weight_kg: weightKg })
  return log
}

export async function listDailyLogs(
  userId: string,
  fromKey: string,
  toKey: string,
): Promise<DailyLog[]> {
  return unwrap(
    await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_on', fromKey)
      .lte('logged_on', toKey)
      .order('logged_on', { ascending: true }),
  )
}
