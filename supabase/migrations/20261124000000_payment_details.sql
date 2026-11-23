-- VetSOS — milestone 6: the owner's payment screen.
--
-- Once the vet finishes the case, the owner (and only the owner of that emergency)
-- can see the final amount and the vet's bank details to transfer.
-- Run after 20261123000000_emergencies_and_offers.sql.

create function public.get_payment_details(p_emergency_id uuid)
returns table (
  vet_name text, vet_phone text,
  final_amount integer, payment_status text, finished_at timestamptz,
  bank_alias text, bank_cbu_cvu text, bank_holder text, bank_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(p.full_name), ''), 'Veterinario/a'), p.phone,
         e.final_amount, e.payment_status, e.finished_at,
         v.bank_alias, v.bank_cbu_cvu, v.bank_holder, v.bank_name
    from public.emergencies e
    join public.vets v on v.profile_id = e.assigned_vet_id
    join public.profiles p on p.id = v.profile_id
   where e.id = p_emergency_id
     and e.owner_id = (select auth.uid())
     and e.status = 'finished';
$$;

revoke execute on function public.get_payment_details(uuid) from public, anon;
grant execute on function public.get_payment_details(uuid) to authenticated;
