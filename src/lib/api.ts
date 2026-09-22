import { supabase } from '@/lib/supabase'
import type { DailyLog, DailyTotals, Food, FoodEntry, Meal, Profile } from '@/lib/types'

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

// ------------------------------------------------------------------ profile

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'display_name' | 'calorie_target' | 'protein_target'>>,
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
  patch: Partial<Pick<DailyLog, 'calorie_target' | 'protein_target' | 'weight_kg' | 'notes'>>,
): Promise<DailyLog> {
  return unwrap(
    await supabase
      .from('daily_logs')
      .upsert({ ...patch, user_id: userId, logged_on: dateKey }, { onConflict: 'user_id,logged_on' })
      .select('*')
      .single(),
  )
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
