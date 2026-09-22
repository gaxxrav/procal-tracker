# procal

A personal calorie and protein tracker. Log what you eat against a daily
target, see the history, and watch the trend.

React + Vite on Vercel, Postgres + Auth on Supabase. No backend of its own —
the browser talks to Supabase directly, and Row Level Security decides what
each user can see.

```
Browser  ->  Vercel (static hosting / CDN)
         ->  Supabase  ->  Postgres + Auth
```

## Stack

| Layer    | Choice                                   |
| -------- | ---------------------------------------- |
| UI       | React 19, Vite 8, Tailwind v4, shadcn/ui |
| Charts   | Recharts                                 |
| Data     | Supabase (Postgres, Auth, RLS)           |
| Hosting  | Vercel                                   |

## Getting started

Requires Node ≥ 20.19 (`.nvmrc` pins 26).

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
npm run dev
```

### Setting up Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open the SQL editor and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. Copy the project URL and anon key from **Settings → API** into `.env.local`.
4. Under **Authentication → Providers**, make sure Email is enabled. For a
   single-user app you can turn off email confirmation to skip the round trip.

The anon key is safe in the browser — it only grants what the RLS policies
allow. The `service_role` key is not, and never belongs in this repo.

## Data model

```
profiles        default targets, one row per auth user
foods           your saved food library, values stored per serving
food_entries    the actual log: one row per thing eaten
daily_logs      per-day notes, weight, and optional target overrides
daily_totals    a view — calories/protein summed per day
```

Two decisions worth knowing:

- **Daily totals are derived, never stored.** They come from the `daily_totals`
  view, so a sum can't drift out of sync with the entries behind it.
- **`food_entries` snapshots its calories and protein at log time.** Editing a
  saved food changes what you log next, not what you logged in March.

Everything is keyed by `user_id` with RLS on, so adding a second user needs no
schema change.

## Deploying to Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new). The Vite preset
   is detected automatically (`npm run build` → `dist`).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings →
   Environment Variables**, for all three environments.
3. Deploy.

`vercel.json` rewrites every path to `index.html` so client-side routes survive
a hard refresh.

## Scripts

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Dev server                          |
| `npm run build`     | Typecheck, then production build    |
| `npm run preview`   | Serve the built output              |
| `npm run typecheck` | Types only                          |
| `npm run lint`      | oxlint                              |
