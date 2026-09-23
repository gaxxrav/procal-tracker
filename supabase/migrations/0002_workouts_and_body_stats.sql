-- procal :: lifting log + personal body stats
--
-- Design notes
--   * One row per exercise-set-group ("Bench 80kg x 8 reps x 3 sets") rather
--     than one row per individual set. That matches how sets are actually
--     called out in a session, and pyramid sets still work — log the same
--     exercise twice with different weights.
--   * Energy/fatigue is a property of the DAY, not of an exercise, so it
--     belongs on daily_logs next to notes and weight.
--   * Body stats live on profiles as "current", not as a time series. BMI is
--     never stored; it is derived from height and weight at render time.

-- ------------------------------------------------- body stats on profiles --

alter table public.profiles
  add column if not exists height_cm numeric(5, 1)
    check (height_cm is null or (height_cm > 0 and height_cm < 300)),
  add column if not exists weight_kg numeric(5, 1)
    check (weight_kg is null or (weight_kg > 0 and weight_kg < 700)),
  add column if not exists age smallint
    check (age is null or (age between 1 and 120)),
  add column if not exists gender text
    check (gender is null or gender in ('male', 'female', 'other', 'prefer_not_to_say'));

-- ------------------------------------------ energy / fatigue for the day --

alter table public.daily_logs
  add column if not exists energy_level smallint
    check (energy_level is null or (energy_level between 1 and 5));

-- ------------------------------------------------------- workout_entries --

create table if not exists public.workout_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  logged_on   date not null default current_date,
  exercise    text not null check (length(trim(exercise)) > 0),
  -- Bodyweight movements are logged at 0 kg.
  weight_kg   numeric(6, 2) not null default 0 check (weight_kg >= 0),
  reps        smallint not null check (reps between 1 and 1000),
  sets        smallint not null default 1 check (sets between 1 and 100),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists workout_entries_user_date_idx
  on public.workout_entries (user_id, logged_on desc);

-- Powers the exercise-name autocomplete without needing a separate library table.
create index if not exists workout_entries_user_exercise_idx
  on public.workout_entries (user_id, exercise);

drop trigger if exists workout_entries_set_updated_at on public.workout_entries;
create trigger workout_entries_set_updated_at
  before update on public.workout_entries
  for each row execute function public.set_updated_at();

alter table public.workout_entries enable row level security;

drop policy if exists "own workouts: read"   on public.workout_entries;
drop policy if exists "own workouts: insert" on public.workout_entries;
drop policy if exists "own workouts: update" on public.workout_entries;
drop policy if exists "own workouts: delete" on public.workout_entries;

create policy "own workouts: read"
  on public.workout_entries for select using (auth.uid() = user_id);
create policy "own workouts: insert"
  on public.workout_entries for insert with check (auth.uid() = user_id);
create policy "own workouts: update"
  on public.workout_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workouts: delete"
  on public.workout_entries for delete using (auth.uid() = user_id);
