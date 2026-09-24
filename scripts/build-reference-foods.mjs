/**
 * Converts the raw nutrition sheet export into the compact reference library
 * the app bundles. Re-run after replacing the source file:
 *
 *   node scripts/build-reference-foods.mjs <source.json>
 *
 * Source rows look like:
 *   { food_name, calories_kcal, protein_g, fiber_g }   // all per 100 g
 */
import { readFileSync, writeFileSync } from 'node:fs'

const source = process.argv[2] ?? 'data/Nutritional_Data_Sheet_Normalized.json'
const out = 'src/data/reference-foods.json'

const rows = JSON.parse(readFileSync(source, 'utf8'))
const round = (v, p = 2) => Math.round(v * 10 ** p) / 10 ** p

const seen = new Set()
const clean = []
const rejected = []

for (const row of rows) {
  const name = String(row.food_name ?? '').replace(/\s+/g, ' ').trim()
  const calories = Number(row.calories_kcal)
  const protein = Number(row.protein_g)
  const fiber = Number(row.fiber_g)

  if (!name) { rejected.push(['blank name', row]); continue }
  if (![calories, protein, fiber].every(Number.isFinite)) { rejected.push(['non-numeric', name]); continue }
  if (calories < 0 || protein < 0 || fiber < 0) { rejected.push(['negative', name]); continue }
  // Nothing edible exceeds ~900 kcal/100 g (pure fat).
  if (calories > 900) { rejected.push(['calories > 900', name]); continue }

  const key = name.toLowerCase()
  if (seen.has(key)) { rejected.push(['duplicate', name]); continue }
  seen.add(key)

  clean.push({
    name,
    calories: round(calories),
    protein: round(protein),
    fiber: round(fiber),
  })
}

clean.sort((a, b) => a.name.localeCompare(b.name))
writeFileSync(out, JSON.stringify(clean) + '\n')

console.log(`${clean.length} foods -> ${out}`)
if (rejected.length) {
  console.log(`${rejected.length} rejected:`)
  for (const [why, what] of rejected.slice(0, 20)) console.log(`  ${why}: ${typeof what === 'string' ? what : JSON.stringify(what)}`)
}
