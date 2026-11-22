import { ServiceMode } from '@/features/emergency/types';
import { Coords } from '@/lib/geo';
import { supabase } from '@/lib/supabase';

export type VetStatus = 'offline' | 'available' | 'busy';

export type VetProfile = {
  fullName: string;
  phone: string;
  licenseNumber: string;
  serviceMode: ServiceMode;
  clinicAddress: string;
  clinicCoords: Coords | null;
  maxHomeKm: number;
  prices: { base: number | null; homeExtra: number | null; nightExtra: number | null };
  bank: { alias: string; cbuCvu: string; holder: string; bankName: string };
};

export type VetState = {
  profile: VetProfile;
  status: VetStatus;
  /** "Ocupado, en 30 min puedo": no new emergencies until this time. */
  snoozedUntil: Date | null;
  lastCoords: Coords | null;
};

export const doesHomeVisits = (mode: ServiceMode) => mode !== 'clinic';
export const hasClinic = (mode: ServiceMode) => mode !== 'home';

/** Everything needed before the vet can go on call. */
export function isVetProfileComplete(p: VetProfile): boolean {
  return Boolean(
    p.fullName.trim() &&
      p.phone.trim() &&
      p.licenseNumber.trim() &&
      p.prices.base !== null &&
      (!hasClinic(p.serviceMode) || (p.clinicAddress.trim() && p.clinicCoords)) &&
      (p.bank.alias.trim() || p.bank.cbuCvu.trim()) &&
      p.bank.holder.trim(),
  );
}

export async function loadVet(userId: string): Promise<VetState> {
  const [profile, vet] = await Promise.all([
    supabase.from('profiles').select('full_name, phone').eq('id', userId).maybeSingle(),
    supabase.from('vets').select('*').eq('profile_id', userId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (vet.error) throw vet.error;

  const v = vet.data;
  return {
    profile: {
      fullName: profile.data?.full_name ?? '',
      phone: profile.data?.phone ?? '',
      licenseNumber: v?.license_number ?? '',
      serviceMode: (v?.service_mode as ServiceMode | undefined) ?? 'both',
      clinicAddress: v?.clinic_address ?? '',
      clinicCoords: v?.clinic_lat != null && v?.clinic_lng != null ? { lat: v.clinic_lat, lng: v.clinic_lng } : null,
      maxHomeKm: v?.max_home_km ?? 10,
      prices: { base: v?.price_base ?? null, homeExtra: v?.price_home_extra ?? null, nightExtra: v?.price_night_extra ?? null },
      bank: {
        alias: v?.bank_alias ?? '',
        cbuCvu: v?.bank_cbu_cvu ?? '',
        holder: v?.bank_holder ?? '',
        bankName: v?.bank_name ?? '',
      },
    },
    status: (v?.status as VetStatus | undefined) ?? 'offline',
    snoozedUntil: v?.snoozed_until ? new Date(v.snoozed_until) : null,
    lastCoords: v?.last_lat != null && v?.last_lng != null ? { lat: v.last_lat, lng: v.last_lng } : null,
  };
}

export async function saveVetProfile(userId: string, p: VetProfile): Promise<void> {
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: p.fullName.trim(), phone: p.phone.trim() })
    .eq('id', userId);
  if (profileError) throw profileError;

  const clinic = hasClinic(p.serviceMode);
  const home = doesHomeVisits(p.serviceMode);
  const { error } = await supabase.from('vets').upsert({
    profile_id: userId,
    license_number: p.licenseNumber.trim(),
    service_mode: p.serviceMode,
    clinic_address: clinic ? p.clinicAddress.trim() : null,
    clinic_lat: clinic ? (p.clinicCoords?.lat ?? null) : null,
    clinic_lng: clinic ? (p.clinicCoords?.lng ?? null) : null,
    max_home_km: p.maxHomeKm,
    price_base: p.prices.base,
    price_home_extra: home ? p.prices.homeExtra : null,
    price_night_extra: p.prices.nightExtra,
    bank_alias: p.bank.alias.trim() || null,
    bank_cbu_cvu: p.bank.cbuCvu.replace(/\D/g, '') || null,
    bank_holder: p.bank.holder.trim(),
    bank_name: p.bank.bankName.trim() || null,
  });
  if (error) throw error;
}

/** Change availability. Going on call also saves where the vet is, for distances. */
export async function setVetStatus(
  userId: string,
  status: VetStatus,
  extra: { coords?: Coords | null; snoozedUntil?: Date | null } = {},
): Promise<void> {
  const update: Record<string, unknown> = { status, last_seen_at: new Date().toISOString() };
  if (extra.coords) {
    update.last_lat = extra.coords.lat;
    update.last_lng = extra.coords.lng;
  }
  if (extra.snoozedUntil !== undefined) update.snoozed_until = extra.snoozedUntil?.toISOString() ?? null;
  const { error } = await supabase.from('vets').update(update).eq('profile_id', userId);
  if (error) throw error;
}

/** "Ocupado, en 30 min puedo": stays on call but gets no emergencies for a while. */
export async function snoozeVet(userId: string, minutes: number): Promise<Date> {
  const until = new Date(Date.now() + minutes * 60_000);
  const { error } = await supabase.from('vets').update({ snoozed_until: until.toISOString() }).eq('profile_id', userId);
  if (error) throw error;
  return until;
}

/** "Recibir urgencias ya": end the pause early. */
export async function clearSnooze(userId: string): Promise<void> {
  const { error } = await supabase.from('vets').update({ snoozed_until: null }).eq('profile_id', userId);
  if (error) throw error;
}
