-- procal-tracker :: initial schema
--
-- Design notes
--   * Daily calorie/protein totals are NEVER stored. They are derived from
--     food_entries via the daily_totals view, so the numbers can't drift.
--   * food_entries snapshots calories/protein at log time. Editing a saved
--     food later does not rewrite history.
--   * daily_logs holds only per-day things that can't be derived: notes,
--     weight, and optional target overrides for that specific day.
--   * Every table is scoped by user_id and locked down with RLS, so this can
--     become multi-user without a redesign.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- helpers --

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------- profiles --

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text,
  calorie_target  integer not null default 2400 check (calorie_target between 0 and 20000),
  protein_target  integer not null default 140  check (protein_target between 0 and 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Give every new auth user a profile row automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ foods --
-- The user's personal library of frequently eaten foods, stored per serving.

create table public.foods (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  name                  text not null check (length(trim(name)) > 0),
  serving_size          numeric(10, 2) not null default 100 check (serving_size > 0),
  serving_unit          text not null default 'g',
  calories_per_serving  numeric(10, 2) not null check (calories_per_serving >= 0),
  protein_per_serving   numeric(8, 2)  not null check (protein_per_serving >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, name)
);

create index foods_user_name_idx on public.foods (user_id, name);

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ food_entries --

create table public.food_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  food_id     uuid references public.foods (id) on delete set null,
  logged_on   date not null default current_date,
  meal        text not null default 'snack'
                check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name   text not null check (length(trim(food_name)) > 0),
  quantity    numeric(10, 2) not null default 1 check (quantity > 0),
  unit        text not null default 'g',
  -- Totals for this entry, not per serving.
  calories    numeric(10, 2) not null check (calories >= 0),
  protein     numeric(8, 2)  not null check (protein >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index food_entries_user_date_idx on public.food_entries (user_id, logged_on desc);

create trigger food_entries_set_updated_at
  before update on public.food_entries
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- daily_logs --
-- Only per-day facts that cannot be derived from food_entries.

create table public.daily_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  logged_on       date not null default current_date,
  -- NULL means "fall back to the profile default target".
  calorie_target  integer check (calorie_target between 0 and 20000),
  protein_target  integer check (protein_target between 0 and 1000),
  weight_kg       numeric(6, 2) check (weight_kg > 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index daily_logs_user_date_idx on public.daily_logs (user_id, logged_on desc);

create trigger daily_logs_set_updated_at
  before update on public.daily_logs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------- views --
-- security_invoker makes the view respect the caller's RLS policies.

create view public.daily_totals
with (security_invoker = true) as
  select
    e.user_id,
    e.logged_on,
    sum(e.calories)::numeric(10, 2) as calories,
    sum(e.protein)::numeric(8, 2)   as protein,
    count(*)                        as entry_count
  from public.food_entries e
  group by e.user_id, e.logged_on;

-- ------------------------------------------------------------------- RLS --

alter table public.profiles     enable row level security;
alter table public.foods        enable row level security;
alter table public.food_entries enable row level security;
alter table public.daily_logs   enable row level security;

create policy "own profile: read"
  on public.profiles for select using (auth.uid() = id);
create policy "own profile: insert"
  on public.profiles for insert with check (auth.uid() = id);
create policy "own profile: update"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "own foods: read"
  on public.foods for select using (auth.uid() = user_id);
create policy "own foods: insert"
  on public.foods for insert with check (auth.uid() = user_id);
create policy "own foods: update"
  on public.foods for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own foods: delete"
  on public.foods for delete using (auth.uid() = user_id);

create policy "own entries: read"
  on public.food_entries for select using (auth.uid() = user_id);
create policy "own entries: insert"
  on public.food_entries for insert with check (auth.uid() = user_id);
create policy "own entries: update"
  on public.food_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own entries: delete"
  on public.food_entries for delete using (auth.uid() = user_id);

create policy "own daily logs: read"
  on public.daily_logs for select using (auth.uid() = user_id);
create policy "own daily logs: insert"
  on public.daily_logs for insert with check (auth.uid() = user_id);
create policy "own daily logs: update"
  on public.daily_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own daily logs: delete"
  on public.daily_logs for delete using (auth.uid() = user_id);
