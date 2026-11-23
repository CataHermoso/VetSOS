-- VetSOS — milestone 5: real emergencies, one offer at a time, atomic accept.
--
-- Nobody writes these tables directly. Every change goes through a server
-- function below, which checks who is calling and keeps the rules:
--   · one vet at a time per emergency, never the same vet twice
--   · a vet gets one offer at a time and can have only one active emergency
--   · accepting is atomic: two vets can't take the same emergency
-- Each side only sees what it needs: the vet gets the owner's phone and
-- exact location only after accepting.

-- ─────────────────────────────────────────────
-- emergencies
-- ─────────────────────────────────────────────
create table public.emergencies (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  lat              double precision not null,
  lng              double precision not null,
  area             text,               -- neighbourhood shown to vets before accepting
  reference        text,               -- address details, shown only after accepting
  has_transport    boolean not null,
  status           text not null default 'searching'
                   check (status in ('searching', 'offered', 'accepted', 'finished', 'cancelled')),
  assigned_vet_id  uuid references public.vets (profile_id) on delete set null,
  radius_km        integer not null default 10 check (radius_km between 1 and 50),
  final_amount     integer check (final_amount >= 0),
  payment_status   text not null default 'none' check (payment_status in ('none', 'pending', 'paid')),
  created_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  finished_at      timestamptz,
  updated_at       timestamptz not null default now()
);

create index emergencies_owner_idx on public.emergencies (owner_id, created_at desc);
-- Lock: a vet can have only one emergency in progress.
create unique index emergencies_one_active_per_vet on public.emergencies (assigned_vet_id) where status = 'accepted';

create trigger emergencies_updated_at before update on public.emergencies
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- emergency_offers: each time an emergency is offered to a vet
-- ─────────────────────────────────────────────
create table public.emergency_offers (
  id               uuid primary key default gen_random_uuid(),
  emergency_id     uuid not null references public.emergencies (id) on delete cascade,
  vet_id           uuid not null references public.vets (profile_id) on delete cascade,
  -- What each side may see while deciding (copied, so nobody reads the other's tables).
  vet_name         text not null,
  owner_first_name text not null,
  area             text,
  has_transport    boolean not null,
  place            text not null check (place in ('clinic', 'home')),
  distance_km      double precision not null,
  sent_at          timestamptz not null default now(),
  expires_at       timestamptz not null,
  response         text check (response in ('accepted', 'rejected', 'timeout', 'cancelled')),
  reason           text check (reason in ('busy_30', 'unavailable_today', 'too_far')),
  responded_at     timestamptz,
  unique (emergency_id, vet_id)   -- never offer the same emergency to the same vet twice
);

create index emergency_offers_emergency_idx on public.emergency_offers (emergency_id, sent_at desc);
-- One open offer per emergency, and one open offer per vet.
create unique index emergency_offers_one_open_per_emergency on public.emergency_offers (emergency_id) where response is null;
create unique index emergency_offers_one_open_per_vet on public.emergency_offers (vet_id) where response is null;

-- ─────────────────────────────────────────────
-- Row level security: read-only, each side sees its own rows
-- ─────────────────────────────────────────────
alter table public.emergencies      enable row level security;
alter table public.emergency_offers enable row level security;

create policy "emergencies: owner or assigned vet reads" on public.emergencies
  for select to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = assigned_vet_id);

create policy "offers: vet reads their own" on public.emergency_offers
  for select to authenticated
  using ((select auth.uid()) = vet_id);

create policy "offers: owner reads their emergency's" on public.emergency_offers
  for select to authenticated
  using (exists (
    select 1 from public.emergencies e
     where e.id = emergency_id and e.owner_id = (select auth.uid())
  ));

grant select on public.emergencies, public.emergency_offers to authenticated;
revoke insert, update, delete, truncate on public.emergencies, public.emergency_offers from authenticated;
revoke all on public.emergencies, public.emergency_offers from anon;

-- Live updates (offers arriving, answers) through Supabase Realtime. RLS still applies.
alter publication supabase_realtime add table public.emergencies, public.emergency_offers;

-- ─────────────────────────────────────────────
-- Helpers (internal)
-- ─────────────────────────────────────────────

-- Straight-line distance in km.
create function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Offers nobody answered in time (+2 s of grace for slow networks) count as "didn't answer".
create function public.close_stale_offers()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.emergency_offers
     set response = 'timeout', responded_at = now()
   where response is null and expires_at < now() - interval '2 seconds';

  update public.emergencies e
     set status = 'searching'
   where e.status = 'offered'
     and not exists (select 1 from public.emergency_offers o where o.emergency_id = e.id and o.response is null);
$$;

-- ─────────────────────────────────────────────
-- Owner functions
-- ─────────────────────────────────────────────

-- "Pedir ayuda ahora": opens an emergency (and closes any earlier open one).
create function public.create_emergency(p_lat double precision, p_lng double precision, p_has_transport boolean, p_area text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if not exists (select 1 from public.profiles where id = v_uid and role = 'owner') then
    raise exception 'not_owner';
  end if;

  update public.emergency_offers o
     set response = 'cancelled', responded_at = now()
    from public.emergencies e
   where o.emergency_id = e.id and e.owner_id = v_uid
     and e.status in ('searching', 'offered') and o.response is null;
  update public.emergencies
     set status = 'cancelled'
   where owner_id = v_uid and status in ('searching', 'offered');

  insert into public.emergencies (owner_id, lat, lng, area, reference, has_transport)
  values (
    v_uid, p_lat, p_lng, nullif(trim(p_area), ''),
    (select nullif(trim(s.address), '') from public.owner_settings s where s.profile_id = v_uid),
    p_has_transport
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Offers the emergency to the nearest compatible vet within the radius.
-- Returns the open offer, or nothing when nobody is left in this radius.
-- Safe to call twice: if a vet is already being asked, returns that offer.
create function public.offer_next(p_emergency_id uuid, p_radius_km integer)
returns setof public.emergency_offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  e           public.emergencies;
  c           record;
  o           public.emergency_offers;
  v_first     text;
begin
  perform public.close_stale_offers();

  select * into e from public.emergencies
   where id = p_emergency_id and owner_id = auth.uid()
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  if e.status not in ('searching', 'offered') then
    return;
  end if;

  select * into o from public.emergency_offers where emergency_id = e.id and response is null;
  if found then
    return next o;
    return;
  end if;

  update public.emergencies
     set radius_km = greatest(radius_km, least(greatest(p_radius_km, 1), 50))
   where id = e.id
  returning * into e;

  select split_part(coalesce(trim(p.full_name), ''), ' ', 1) into v_first
    from public.profiles p where p.id = e.owner_id;

  -- A few tries in case another owner grabs the same vet at the same moment.
  for attempt in 1..5 loop
    select v.profile_id,
           coalesce(nullif(trim(p.full_name), ''), 'Veterinario/a') as name,
           pl.place,
           d.km
      into c
      from public.vets v
      join public.profiles p on p.id = v.profile_id
      -- Owner can travel and the vet has a clinic → meet at the clinic. Otherwise the vet goes.
      cross join lateral (
        select case
                 when e.has_transport and v.service_mode <> 'home'
                      and v.clinic_lat is not null and v.clinic_lng is not null
                 then 'clinic' else 'home'
               end as place
      ) pl
      cross join lateral (
        select case
                 when pl.place = 'clinic' then public.km_between(e.lat, e.lng, v.clinic_lat, v.clinic_lng)
                 else public.km_between(e.lat, e.lng, v.last_lat, v.last_lng)
               end as km
      ) d
     where v.status = 'available'
       and (v.snoozed_until is null or v.snoozed_until < now())
       and v.last_seen_at > now() - interval '3 minutes'   -- app open recently
       and v.price_base is not null                          -- profile filled in
       and v.profile_id <> e.owner_id
       and (pl.place = 'clinic' or v.service_mode <> 'clinic')
       and d.km is not null
       and d.km <= e.radius_km
       and (pl.place = 'clinic' or d.km <= v.max_home_km)
       and not exists (select 1 from public.emergency_offers x where x.emergency_id = e.id and x.vet_id = v.profile_id)
       and not exists (select 1 from public.emergency_offers x where x.vet_id = v.profile_id and x.response is null)
     order by d.km
     limit 1;

    if not found then
      update public.emergencies set status = 'searching' where id = e.id;
      return;
    end if;

    insert into public.emergency_offers
      (emergency_id, vet_id, vet_name, owner_first_name, area, has_transport, place, distance_km, expires_at)
    values
      (e.id, c.profile_id, c.name, coalesce(nullif(v_first, ''), 'Alguien'), e.area, e.has_transport,
       c.place, c.km, now() + interval '45 seconds')
    on conflict (vet_id) where response is null do nothing
    returning * into o;

    if found then
      update public.emergencies set status = 'offered' where id = e.id;
      return next o;
      return;
    end if;
  end loop;

  return;
end;
$$;

-- Called when the owner's countdown runs out: closes the offer if it really expired.
create function public.expire_offer(p_offer_id uuid)
returns setof public.emergency_offers
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.close_stale_offers();
  return query
    select o.* from public.emergency_offers o
      join public.emergencies e on e.id = o.emergency_id
     where o.id = p_offer_id and e.owner_id = auth.uid();
end;
$$;

-- "Cancelar búsqueda".
create function public.cancel_emergency(p_emergency_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.emergencies;
begin
  select * into e from public.emergencies
   where id = p_emergency_id and owner_id = auth.uid()
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  if e.status in ('searching', 'offered') then
    update public.emergency_offers
       set response = 'cancelled', responded_at = now()
     where emergency_id = e.id and response is null;
    update public.emergencies set status = 'cancelled' where id = e.id;
  end if;
end;
$$;

-- The vet who accepted: name, phone, clinic and prices. Only for the owner, only once accepted.
create function public.get_assigned_vet(p_emergency_id uuid)
returns table (
  vet_id uuid, full_name text, phone text, service_mode text,
  clinic_address text, clinic_lat double precision, clinic_lng double precision, max_home_km integer,
  price_base integer, price_home_extra integer, price_night_extra integer,
  place text, distance_km double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.profile_id, p.full_name, p.phone, v.service_mode,
         v.clinic_address, v.clinic_lat, v.clinic_lng, v.max_home_km,
         v.price_base, v.price_home_extra, v.price_night_extra,
         o.place, o.distance_km
    from public.emergencies e
    join public.vets v on v.profile_id = e.assigned_vet_id
    join public.profiles p on p.id = v.profile_id
    join public.emergency_offers o on o.emergency_id = e.id and o.vet_id = v.profile_id
   where e.id = p_emergency_id
     and e.owner_id = (select auth.uid())
     and e.status in ('accepted', 'finished');
$$;

-- ─────────────────────────────────────────────
-- Vet functions
-- ─────────────────────────────────────────────

-- Aceptar / Rechazar. Returns 'accepted' | 'rejected' | 'expired' | 'gone' | 'busy'.
create function public.respond_offer(p_offer_id uuid, p_accept boolean, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_em_id  uuid;
  e        public.emergencies;
  o        public.emergency_offers;
  v_reason text := case when p_reason in ('busy_30', 'unavailable_today', 'too_far') then p_reason end;
begin
  select emergency_id into v_em_id from public.emergency_offers where id = p_offer_id and vet_id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;

  -- Same lock order as the owner's functions (emergency, then offer) to avoid deadlocks.
  select * into e from public.emergencies where id = v_em_id for update;
  select * into o from public.emergency_offers where id = p_offer_id for update;

  if o.response = 'timeout' or (o.response is null and now() > o.expires_at + interval '2 seconds') then
    update public.emergency_offers set response = 'timeout', responded_at = now()
     where id = o.id and response is null;
    update public.emergencies set status = 'searching' where id = e.id and status = 'offered';
    return 'expired';
  end if;
  if o.response is not null then
    return 'gone';   -- the owner cancelled
  end if;
  if e.status <> 'offered' then
    update public.emergency_offers set response = 'cancelled', responded_at = now() where id = o.id;
    return 'gone';
  end if;

  if p_accept then
    if exists (select 1 from public.emergencies where assigned_vet_id = v_uid and status = 'accepted') then
      return 'busy';
    end if;
    update public.emergency_offers set response = 'accepted', responded_at = now() where id = o.id;
    update public.emergencies
       set status = 'accepted', assigned_vet_id = v_uid, accepted_at = now()
     where id = e.id;
    update public.vets
       set status = 'busy', snoozed_until = null, last_seen_at = now()
     where profile_id = v_uid;
    return 'accepted';
  end if;

  update public.emergency_offers
     set response = 'rejected', reason = v_reason, responded_at = now()
   where id = o.id;
  update public.emergencies set status = 'searching' where id = e.id;

  if v_reason = 'busy_30' then
    update public.vets set snoozed_until = now() + interval '30 minutes' where profile_id = v_uid;
  elsif v_reason = 'unavailable_today' then
    update public.vets set status = 'offline', snoozed_until = null where profile_id = v_uid;
  end if;

  return 'rejected';
end;
$$;

-- The vet's emergency in progress, with the owner's phone and exact location.
create function public.get_vet_case()
returns table (
  emergency_id uuid, offer_id uuid, owner_first_name text, owner_phone text,
  lat double precision, lng double precision, area text, reference text,
  has_transport boolean, place text, distance_km double precision, accepted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, o.id, o.owner_first_name, p.phone,
         e.lat, e.lng, e.area, e.reference,
         e.has_transport, o.place, o.distance_km, e.accepted_at
    from public.emergencies e
    join public.emergency_offers o on o.emergency_id = e.id and o.vet_id = e.assigned_vet_id
    join public.profiles p on p.id = e.owner_id
   where e.assigned_vet_id = (select auth.uid())
     and e.status = 'accepted'
   limit 1;
$$;

-- "Finalizar atención": final amount, payment pending.
create function public.finish_emergency(p_emergency_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.emergencies
     set status = 'finished', final_amount = greatest(p_amount, 0),
         payment_status = 'pending', finished_at = now()
   where id = p_emergency_id and assigned_vet_id = auth.uid() and status = 'accepted';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- "Pago realizado" (or back to pending).
create function public.set_payment(p_emergency_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('pending', 'paid') then
    raise exception 'bad_status';
  end if;
  update public.emergencies
     set payment_status = p_status
   where id = p_emergency_id and assigned_vet_id = auth.uid() and status = 'finished';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- Who can call what
-- ─────────────────────────────────────────────
revoke execute on function public.km_between(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.close_stale_offers() from public, anon, authenticated;

revoke execute on function public.create_emergency(double precision, double precision, boolean, text) from public, anon;
revoke execute on function public.offer_next(uuid, integer)        from public, anon;
revoke execute on function public.expire_offer(uuid)              from public, anon;
revoke execute on function public.cancel_emergency(uuid)          from public, anon;
revoke execute on function public.get_assigned_vet(uuid)          from public, anon;
revoke execute on function public.respond_offer(uuid, boolean, text) from public, anon;
revoke execute on function public.get_vet_case()                  from public, anon;
revoke execute on function public.finish_emergency(uuid, integer) from public, anon;
revoke execute on function public.set_payment(uuid, text)         from public, anon;

grant execute on function public.create_emergency(double precision, double precision, boolean, text) to authenticated;
grant execute on function public.offer_next(uuid, integer)        to authenticated;
grant execute on function public.expire_offer(uuid)               to authenticated;
grant execute on function public.cancel_emergency(uuid)           to authenticated;
grant execute on function public.get_assigned_vet(uuid)           to authenticated;
grant execute on function public.respond_offer(uuid, boolean, text) to authenticated;
grant execute on function public.get_vet_case()                   to authenticated;
grant execute on function public.finish_emergency(uuid, integer)  to authenticated;
grant execute on function public.set_payment(uuid, text)          to authenticated;
