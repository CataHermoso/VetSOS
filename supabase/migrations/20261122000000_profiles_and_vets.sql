-- VetSOS — milestone 2: profiles, owner settings, vets.
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Emergencies and offers come in milestone 5.

-- ─────────────────────────────────────────────
-- profiles: one row per user (owner or vet)
-- ─────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'vet')),
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- owner_settings: data saved for future emergencies
-- ─────────────────────────────────────────────
create table public.owner_settings (
  profile_id     uuid primary key references public.profiles (id) on delete cascade,
  address        text,
  lat            double precision,
  lng            double precision,
  has_transport  boolean,
  updated_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- vets: how they work, prices, bank details, availability
-- ─────────────────────────────────────────────
create table public.vets (
  profile_id         uuid primary key references public.profiles (id) on delete cascade,
  license_number     text,
  service_mode       text not null default 'both' check (service_mode in ('home', 'clinic', 'both')),
  clinic_address     text,
  clinic_lat         double precision,
  clinic_lng         double precision,
  max_home_km        integer not null default 10 check (max_home_km > 0),

  -- prices in ARS, whole pesos
  price_base         integer check (price_base >= 0),
  price_home_extra   integer check (price_home_extra >= 0),
  price_night_extra  integer check (price_night_extra >= 0),

  bank_alias         text,
  bank_cbu_cvu       text,
  bank_holder        text,
  bank_name          text,

  status             text not null default 'offline' check (status in ('offline', 'available', 'busy')),
  snoozed_until      timestamptz,
  last_lat           double precision,
  last_lng           double precision,
  last_seen_at       timestamptz,
  updated_at         timestamptz not null default now()
);

create index vets_status_idx on public.vets (status);

-- ─────────────────────────────────────────────
-- keep updated_at current
-- ─────────────────────────────────────────────
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger owner_settings_updated_at before update on public.owner_settings
  for each row execute function public.set_updated_at();
create trigger vets_updated_at before update on public.vets
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- Row Level Security: everyone only sees and edits their own rows.
-- (Owners seeing an accepted vet's phone/prices comes in milestone 5,
--  through a server function, never by opening up the vets table.)
-- ─────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.owner_settings enable row level security;
alter table public.vets           enable row level security;

create policy "own profile: read"   on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile: create" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own owner settings: read"   on public.owner_settings for select to authenticated using ((select auth.uid()) = profile_id);
create policy "own owner settings: create" on public.owner_settings for insert to authenticated with check ((select auth.uid()) = profile_id);
create policy "own owner settings: update" on public.owner_settings for update to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);

create policy "own vet row: read"   on public.vets for select to authenticated using ((select auth.uid()) = profile_id);
create policy "own vet row: create" on public.vets for insert to authenticated with check ((select auth.uid()) = profile_id);
create policy "own vet row: update" on public.vets for update to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);

-- Logged-in users (including anonymous ones) can use these tables through the API;
-- the policies above still limit them to their own rows. Logged-out requests get nothing.
grant select, insert, update on public.profiles, public.owner_settings, public.vets to authenticated;
revoke all on public.profiles, public.owner_settings, public.vets from anon;
