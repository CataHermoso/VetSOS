-- VetSOS — appointments ("Sacar turno").
--
-- Vets publish weekly hours (clinic or home visits). Owners book a free time.
-- Free times = hours minus anything booked. The database itself refuses two
-- appointments that overlap for the same vet, so double booking can't happen.
-- Times are Argentina local time (America/Argentina/Buenos_Aires).
-- Run after 20261124000000_payment_details.sql.

create extension if not exists btree_gist with schema extensions;

-- ─────────────────────────────────────────────
-- vets: appointment settings
-- ─────────────────────────────────────────────
alter table public.vets
  add column slot_minutes      integer not null default 30 check (slot_minutes between 15 and 120),
  add column price_appointment integer check (price_appointment >= 0);

-- ─────────────────────────────────────────────
-- vet_schedule: weekly hours (e.g. Monday 09:00–13:00 at the clinic)
-- ─────────────────────────────────────────────
create table public.vet_schedule (
  id          uuid primary key default gen_random_uuid(),
  vet_id      uuid not null references public.vets (profile_id) on delete cascade,
  weekday     integer not null check (weekday between 0 and 6),   -- 0 = Sunday … 6 = Saturday
  start_time  time not null,
  end_time    time not null,
  place       text not null check (place in ('clinic', 'home')),
  created_at  timestamptz not null default now(),
  check (end_time > start_time)
);

create index vet_schedule_vet_idx on public.vet_schedule (vet_id, weekday);

alter table public.vet_schedule enable row level security;

create policy "own schedule: read"   on public.vet_schedule for select to authenticated using ((select auth.uid()) = vet_id);
create policy "own schedule: create" on public.vet_schedule for insert to authenticated with check ((select auth.uid()) = vet_id);
create policy "own schedule: update" on public.vet_schedule for update to authenticated using ((select auth.uid()) = vet_id) with check ((select auth.uid()) = vet_id);
create policy "own schedule: delete" on public.vet_schedule for delete to authenticated using ((select auth.uid()) = vet_id);

grant select, insert, update, delete on public.vet_schedule to authenticated;
revoke all on public.vet_schedule from anon;

-- ─────────────────────────────────────────────
-- appointments
-- ─────────────────────────────────────────────
create table public.appointments (
  id              uuid primary key default gen_random_uuid(),
  vet_id          uuid not null references public.vets (profile_id) on delete cascade,
  owner_id        uuid references public.profiles (id) on delete set null,  -- null = booked by the vet by phone
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  place           text not null check (place in ('clinic', 'home')),
  status          text not null default 'booked' check (status in ('booked', 'cancelled', 'finished')),
  reason          text,
  -- Where to go for home visits (copied from the owner's saved data when booking).
  lat             double precision,
  lng             double precision,
  reference       text,
  -- Phone bookings: who called.
  contact_name    text,
  contact_phone   text,
  created_by      text not null check (created_by in ('owner', 'vet')),
  cancelled_by    text check (cancelled_by in ('owner', 'vet')),
  final_amount    integer check (final_amount >= 0),
  payment_status  text not null default 'none' check (payment_status in ('none', 'pending', 'paid')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at),
  -- No two active appointments of the same vet can overlap in time.
  constraint appointments_no_overlap exclude using gist (
    vet_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled')
);

create index appointments_owner_idx on public.appointments (owner_id, starts_at);
create index appointments_vet_idx on public.appointments (vet_id, starts_at);

create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

create policy "appointments: owner or vet reads" on public.appointments
  for select to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = vet_id);

grant select on public.appointments to authenticated;
revoke insert, update, delete, truncate on public.appointments from authenticated;
revoke all on public.appointments from anon;

-- ─────────────────────────────────────────────
-- Owner: find vets, see free times, book
-- ─────────────────────────────────────────────

-- Vets who offer appointments at that place near the owner, nearest first.
create function public.find_appointment_vets(p_place text, p_lat double precision, p_lng double precision)
returns table (
  vet_id uuid, full_name text, service_mode text, clinic_address text,
  distance_km double precision, price_appointment integer, price_home_extra integer, slot_minutes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.profile_id, coalesce(nullif(trim(p.full_name), ''), 'Veterinario/a'), v.service_mode, v.clinic_address,
         d.km, v.price_appointment, coalesce(v.price_home_extra, 0), v.slot_minutes
    from public.vets v
    join public.profiles p on p.id = v.profile_id
    cross join lateral (
      select case
               when p_place = 'clinic' then public.km_between(p_lat, p_lng, v.clinic_lat, v.clinic_lng)
               -- Home visits: from the clinic if they have one, otherwise from where they last were.
               when v.clinic_lat is not null then public.km_between(p_lat, p_lng, v.clinic_lat, v.clinic_lng)
               else public.km_between(p_lat, p_lng, v.last_lat, v.last_lng)
             end as km
    ) d
   where auth.uid() is not null
     and v.profile_id <> auth.uid()
     and v.price_appointment is not null
     and exists (select 1 from public.vet_schedule s where s.vet_id = v.profile_id and s.place = p_place)
     and d.km is not null
     and (
       (p_place = 'clinic' and v.service_mode <> 'home' and v.clinic_lat is not null and d.km <= 30)
       or (p_place = 'home' and v.service_mode <> 'clinic' and d.km <= v.max_home_km)
     )
   order by d.km
   limit 30;
$$;

-- Free times of a vet at a place: weekly hours minus anything booked, from 1 h ahead, up to p_days days.
create function public.get_free_slots(p_vet_id uuid, p_place text, p_days integer default 14)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select slot_minutes from public.vets where profile_id = p_vet_id and price_appointment is not null
  ),
  days as (
    select g::date as day
      from generate_series(
        (now() at time zone 'America/Argentina/Buenos_Aires')::date,
        (now() at time zone 'America/Argentina/Buenos_Aires')::date + (least(greatest(p_days, 1), 30) - 1),
        interval '1 day'
      ) g
  ),
  slots as (
    select ((d.day + sc.start_time + make_interval(mins => n * v.slot_minutes)) at time zone 'America/Argentina/Buenos_Aires') as starts_at,
           v.slot_minutes
      from days d
      join public.vet_schedule sc
        on sc.vet_id = p_vet_id and sc.place = p_place and sc.weekday = extract(dow from d.day)::integer
      cross join v
      cross join lateral generate_series(
        0, floor(extract(epoch from (sc.end_time - sc.start_time)) / 60 / v.slot_minutes)::integer - 1
      ) n
  )
  select distinct s.starts_at, s.starts_at + make_interval(mins => s.slot_minutes)
    from slots s
   where auth.uid() is not null
     and s.starts_at > now() + interval '1 hour'
     and not exists (
       select 1 from public.appointments a
        where a.vet_id = p_vet_id and a.status <> 'cancelled'
          and tstzrange(a.starts_at, a.ends_at) && tstzrange(s.starts_at, s.starts_at + make_interval(mins => s.slot_minutes))
     )
   order by 1;
$$;

-- Book one of those free times. Raises 'slot_taken' if someone got it first.
create function public.book_appointment(p_vet_id uuid, p_place text, p_starts_at timestamptz, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_end  timestamptz;
  v_id   uuid;
  s      public.owner_settings;
begin
  if not exists (select 1 from public.profiles where id = v_uid and role = 'owner') then
    raise exception 'not_owner';
  end if;

  select f.ends_at into v_end
    from public.get_free_slots(p_vet_id, p_place, 30) f
   where f.starts_at = p_starts_at;
  if not found then
    raise exception 'slot_taken';
  end if;

  select * into s from public.owner_settings where profile_id = v_uid;

  begin
    insert into public.appointments
      (vet_id, owner_id, starts_at, ends_at, place, reason, lat, lng, reference, created_by)
    values
      (p_vet_id, v_uid, p_starts_at, v_end, p_place, nullif(trim(p_reason), ''),
       case when p_place = 'home' then s.lat end,
       case when p_place = 'home' then s.lng end,
       case when p_place = 'home' then nullif(trim(s.address), '') end,
       'owner')
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;

  return v_id;
end;
$$;

-- The owner's appointments (upcoming, and the last 30 days), with the vet's details.
create function public.get_owner_appointments()
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, place text, status text, reason text,
  vet_name text, vet_phone text, clinic_address text, clinic_lat double precision, clinic_lng double precision,
  price_appointment integer, price_home_extra integer,
  final_amount integer, payment_status text, cancelled_by text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.starts_at, a.ends_at, a.place, a.status, a.reason,
         coalesce(nullif(trim(p.full_name), ''), 'Veterinario/a'), p.phone,
         v.clinic_address, v.clinic_lat, v.clinic_lng,
         v.price_appointment, coalesce(v.price_home_extra, 0),
         a.final_amount, a.payment_status, a.cancelled_by
    from public.appointments a
    join public.vets v on v.profile_id = a.vet_id
    join public.profiles p on p.id = a.vet_id
   where a.owner_id = (select auth.uid())
     and a.starts_at > now() - interval '30 days'
   order by a.starts_at;
$$;

-- What to pay for a finished appointment (owner only).
create function public.get_appointment_payment(p_appointment_id uuid)
returns table (
  vet_name text, vet_phone text,
  final_amount integer, payment_status text,
  bank_alias text, bank_cbu_cvu text, bank_holder text, bank_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(p.full_name), ''), 'Veterinario/a'), p.phone,
         a.final_amount, a.payment_status,
         v.bank_alias, v.bank_cbu_cvu, v.bank_holder, v.bank_name
    from public.appointments a
    join public.vets v on v.profile_id = a.vet_id
    join public.profiles p on p.id = a.vet_id
   where a.id = p_appointment_id
     and a.owner_id = (select auth.uid())
     and a.status = 'finished';
$$;

-- ─────────────────────────────────────────────
-- Vet: agenda, phone bookings, finish
-- ─────────────────────────────────────────────

-- The vet's appointments (upcoming, and the last 7 days), with who booked and where.
create function public.get_vet_appointments()
returns table (
  id uuid, starts_at timestamptz, ends_at timestamptz, place text, status text, reason text,
  contact_name text, contact_phone text, lat double precision, lng double precision, reference text,
  created_by text, cancelled_by text, final_amount integer, payment_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.starts_at, a.ends_at, a.place, a.status, a.reason,
         coalesce(a.contact_name, nullif(trim(p.full_name), ''), 'Dueño/a'),
         coalesce(a.contact_phone, p.phone),
         a.lat, a.lng, a.reference,
         a.created_by, a.cancelled_by, a.final_amount, a.payment_status
    from public.appointments a
    left join public.profiles p on p.id = a.owner_id
   where a.vet_id = (select auth.uid())
     and a.starts_at > now() - interval '7 days'
   order by a.starts_at;
$$;

-- An appointment the vet books by hand (someone called). Any time, as long as it doesn't overlap.
create function public.add_manual_appointment(
  p_starts_at timestamptz, p_place text, p_name text, p_phone text default null, p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_min  integer;
  v_id   uuid;
begin
  select slot_minutes into v_min from public.vets where profile_id = v_uid;
  if not found then
    raise exception 'not_vet';
  end if;
  if p_place not in ('clinic', 'home') then
    raise exception 'bad_place';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'missing_name';
  end if;

  begin
    insert into public.appointments
      (vet_id, starts_at, ends_at, place, reason, contact_name, contact_phone, created_by)
    values
      (v_uid, p_starts_at, p_starts_at + make_interval(mins => v_min), p_place,
       nullif(trim(p_note), ''), trim(p_name), nullif(trim(p_phone), ''), 'vet')
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;

  return v_id;
end;
$$;

-- Either side cancels; the time becomes free again.
create function public.cancel_appointment(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.appointments
     set status = 'cancelled',
         cancelled_by = case when vet_id = v_uid then 'vet' else 'owner' end
   where id = p_appointment_id
     and status = 'booked'
     and (vet_id = v_uid or owner_id = v_uid);
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- After the visit: final amount, payment pending.
create function public.finish_appointment(p_appointment_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.appointments
     set status = 'finished', final_amount = greatest(p_amount, 0), payment_status = 'pending'
   where id = p_appointment_id and vet_id = auth.uid() and status = 'booked';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.set_appointment_payment(p_appointment_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('pending', 'paid') then
    raise exception 'bad_status';
  end if;
  update public.appointments
     set payment_status = p_status
   where id = p_appointment_id and vet_id = auth.uid() and status = 'finished';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- Who can call what
-- ─────────────────────────────────────────────
revoke execute on function public.find_appointment_vets(text, double precision, double precision) from public, anon;
revoke execute on function public.get_free_slots(uuid, text, integer)                    from public, anon;
revoke execute on function public.book_appointment(uuid, text, timestamptz, text)        from public, anon;
revoke execute on function public.get_owner_appointments()                               from public, anon;
revoke execute on function public.get_appointment_payment(uuid)                          from public, anon;
revoke execute on function public.get_vet_appointments()                                 from public, anon;
revoke execute on function public.add_manual_appointment(timestamptz, text, text, text, text) from public, anon;
revoke execute on function public.cancel_appointment(uuid)                               from public, anon;
revoke execute on function public.finish_appointment(uuid, integer)                      from public, anon;
revoke execute on function public.set_appointment_payment(uuid, text)                    from public, anon;

grant execute on function public.find_appointment_vets(text, double precision, double precision) to authenticated;
grant execute on function public.get_free_slots(uuid, text, integer)                    to authenticated;
grant execute on function public.book_appointment(uuid, text, timestamptz, text)        to authenticated;
grant execute on function public.get_owner_appointments()                               to authenticated;
grant execute on function public.get_appointment_payment(uuid)                          to authenticated;
grant execute on function public.get_vet_appointments()                                 to authenticated;
grant execute on function public.add_manual_appointment(timestamptz, text, text, text, text) to authenticated;
grant execute on function public.cancel_appointment(uuid)                               to authenticated;
grant execute on function public.finish_appointment(uuid, integer)                      to authenticated;
grant execute on function public.set_appointment_payment(uuid, text)                    to authenticated;
