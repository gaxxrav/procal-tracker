-- procal :: date of birth, daily weigh-ins, derived workout totals
--
-- Design notes
--   * age was a stored integer, which silently goes stale. Replaced by
--     birth_date, from which age is derived at render time. Existing ages are
--     backfilled to an approximate birth date so nothing is lost.
--   * Workout volume follows the same rule as calories: derived in a view,
--     never stored, so it can't drift from the sets behind it.
--   * Daily weigh-ins already had a home (daily_logs.weight_kg). The app now
--     writes it, and mirrors the latest value onto profiles.weight_kg so BMI
--     tracks the most recent weigh-in without a second source of truth.

-- --------------------------------------------------- birth_date over age --

alter table public.profiles
  add column if not exists birth_date date
    check (birth_date is null or birth_date > date '1900-01-01');

-- Approximate: we only ever knew the age, not the day. Users can correct it.
update public.profiles
   set birth_date = (current_date - make_interval(years => age))::date
 where age is not null
   and birth_date is null;

alter table public.profiles drop column if exists age;

-- ---------------------------------------------- derived workout totals --

create or replace view public.daily_workout_totals
with (security_invoker = true) as
  select
    w.user_id,
    w.logged_on,
    sum(w.weight_kg * w.reps * w.sets)::numeric(12, 2) as volume,
    sum(w.sets)::integer                               as total_sets,
    sum(w.reps * w.sets)::integer                      as total_reps,
    count(distinct lower(trim(w.exercise)))::integer   as exercises
  from public.workout_entries w
  group by w.user_id, w.logged_on;
