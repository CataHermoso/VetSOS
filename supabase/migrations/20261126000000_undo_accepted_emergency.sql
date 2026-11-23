-- VetSOS — undoing an accepted emergency.
--
-- · The vet can't go ("No puedo ir"): the emergency goes back to searching,
--   the owner is told and can look for another vet (never the same one again).
-- · The owner no longer needs help ("Ya no necesito ayuda"): the emergency is
--   cancelled and the vet is free again.
-- Run after 20261125000000_appointments.sql.

-- An offer can now end as 'released': accepted, then the vet couldn't go.
alter table public.emergency_offers drop constraint emergency_offers_response_check;
alter table public.emergency_offers add constraint emergency_offers_response_check
  check (response in ('accepted', 'rejected', 'timeout', 'cancelled', 'released'));

-- Who cancelled an emergency, so the other side can be told.
alter table public.emergencies
  add column cancelled_by text check (cancelled_by in ('owner', 'vet'));

-- Vet: "No puedo ir". The emergency goes back to the owner's search; the vet goes off call.
create function public.release_emergency(p_emergency_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  e     public.emergencies;
begin
  select * into e from public.emergencies
   where id = p_emergency_id and assigned_vet_id = v_uid and status = 'accepted'
   for update;
  if not found then
    raise exception 'not_found';
  end if;

  update public.emergency_offers
     set response = 'released', responded_at = now()
   where emergency_id = e.id and vet_id = v_uid and response = 'accepted';

  update public.emergencies
     set status = 'searching', assigned_vet_id = null, accepted_at = null
   where id = e.id;

  -- Off call: if they can't go to this one, they probably can't take the next either.
  update public.vets
     set status = 'offline', snoozed_until = null, last_seen_at = now()
   where profile_id = v_uid;
end;
$$;

-- Owner: cancel while searching (as before) or after a vet accepted (the vet is freed).
create or replace function public.cancel_emergency(p_emergency_id uuid)
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
    update public.emergencies set status = 'cancelled', cancelled_by = 'owner' where id = e.id;
  elsif e.status = 'accepted' then
    update public.emergencies set status = 'cancelled', cancelled_by = 'owner' where id = e.id;
    -- The vet is free again (back on call).
    update public.vets
       set status = 'available', last_seen_at = now()
     where profile_id = e.assigned_vet_id and status = 'busy';
  end if;
end;
$$;

revoke execute on function public.release_emergency(uuid) from public, anon;
grant execute on function public.release_emergency(uuid) to authenticated;
