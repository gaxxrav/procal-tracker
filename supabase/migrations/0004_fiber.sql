-- procal :: fiber as a third tracked nutrient
--
-- Mirrors how protein already works: a per-serving figure on saved foods, a
-- snapshot on each entry, a daily target on the profile, and a derived total
-- in the daily_totals view. More is good, so the meter treats overshoot the
-- way it treats protein rather than the way it treats calories.

alter table public.profiles
  add column if not exists fiber_target integer not null default 30
    check (fiber_target between 0 and 500);

alter table public.foods
  add column if not exists fiber_per_serving numeric(8, 2) not null default 0
    check (fiber_per_serving >= 0);

alter table public.food_entries
  add column if not exists fiber numeric(8, 2) not null default 0
    check (fiber >= 0);

alter table public.daily_logs
  add column if not exists fiber_target integer
    check (fiber_target is null or (fiber_target between 0 and 500));

-- Adding a trailing column to an existing view is allowed by CREATE OR REPLACE.
create or replace view public.daily_totals
with (security_invoker = true) as
  select
    e.user_id,
    e.logged_on,
    sum(e.calories)::numeric(10, 2) as calories,
    sum(e.protein)::numeric(8, 2)   as protein,
    count(*)                        as entry_count,
    sum(e.fiber)::numeric(8, 2)     as fiber
  from public.food_entries e
  group by e.user_id, e.logged_on;
