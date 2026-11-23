// Server calls for appointments (see supabase/migrations/20261125000000_appointments.sql).

import { Place } from '@/features/emergency/types';
import { supabase } from '@/lib/supabase';

export type Slot = { startsAt: string; endsAt: string };

export type ScheduleRow = { id: string; weekday: number; startTime: string; endTime: string; place: Place };

export type AppointmentStatus = 'booked' | 'cancelled' | 'finished';
export type PaymentStatus = 'none' | 'pending' | 'paid';

/** Server errors raised on purpose → words people understand. */
export function appointmentErrorMessage(e: unknown): string {
  const text = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (text.includes('slot_taken')) return 'Ese horario se acaba de ocupar. Elegí otro.';
  if (text.includes('not_owner')) return 'Esta cuenta está en modo veterinario. Tocá "Cambiar de modo" y elegí "Tengo una mascota".';
  if (text.includes('not_found')) return 'No encontramos ese turno. Puede que ya se haya cancelado.';
  if (text.includes('missing_name')) return 'Escribí el nombre de quien pidió el turno.';
  if (text.includes('Failed to fetch') || text.includes('Network')) return 'No hay conexión. Revisá internet y probá de nuevo.';
  return text || 'Algo salió mal. Probá de nuevo.';
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

// ── Both ──────────────────────────────────────────────

/** Free times of a vet at a place, from 1 h ahead up to 14 days. */
export async function getFreeSlots(vetId: string, place: Place): Promise<Slot[]> {
  const rows = await rpc<{ starts_at: string; ends_at: string }[]>('get_free_slots', { p_vet_id: vetId, p_place: place, p_days: 14 });
  return (rows ?? []).map((r) => ({ startsAt: r.starts_at, endsAt: r.ends_at }));
}

// ── Owner ──────────────────────────────────────────────

export type AppointmentVet = {
  vetId: string;
  name: string;
  clinicAddress: string | null;
  distanceKm: number;
  price: number;
  homeExtra: number;
  slotMinutes: number;
};

export async function findAppointmentVets(place: Place, lat: number, lng: number): Promise<AppointmentVet[]> {
  const rows = await rpc<
    {
      vet_id: string;
      full_name: string;
      clinic_address: string | null;
      distance_km: number;
      price_appointment: number;
      price_home_extra: number;
      slot_minutes: number;
    }[]
  >('find_appointment_vets', { p_place: place, p_lat: lat, p_lng: lng });
  return (rows ?? []).map((r) => ({
    vetId: r.vet_id,
    name: r.full_name,
    clinicAddress: r.clinic_address,
    distanceKm: r.distance_km,
    price: r.price_appointment,
    homeExtra: r.price_home_extra,
    slotMinutes: r.slot_minutes,
  }));
}

export async function bookAppointment(vetId: string, place: Place, startsAt: string, reason: string): Promise<string> {
  return rpc<string>('book_appointment', { p_vet_id: vetId, p_place: place, p_starts_at: startsAt, p_reason: reason || null });
}

export type OwnerAppointment = {
  id: string;
  startsAt: Date;
  place: Place;
  status: AppointmentStatus;
  reason: string | null;
  vetName: string;
  vetPhone: string;
  clinic: { address: string; coords: { lat: number; lng: number } } | null;
  price: number;
  homeExtra: number;
  finalAmount: number | null;
  paymentStatus: PaymentStatus;
  cancelledBy: 'owner' | 'vet' | null;
};

export async function getOwnerAppointments(): Promise<OwnerAppointment[]> {
  const rows = await rpc<
    {
      id: string;
      starts_at: string;
      place: Place;
      status: AppointmentStatus;
      reason: string | null;
      vet_name: string;
      vet_phone: string | null;
      clinic_address: string | null;
      clinic_lat: number | null;
      clinic_lng: number | null;
      price_appointment: number | null;
      price_home_extra: number;
      final_amount: number | null;
      payment_status: PaymentStatus;
      cancelled_by: 'owner' | 'vet' | null;
    }[]
  >('get_owner_appointments');
  return (rows ?? []).map((r) => ({
    id: r.id,
    startsAt: new Date(r.starts_at),
    place: r.place,
    status: r.status,
    reason: r.reason,
    vetName: r.vet_name,
    vetPhone: r.vet_phone ?? '',
    clinic:
      r.clinic_address && r.clinic_lat != null && r.clinic_lng != null
        ? { address: r.clinic_address, coords: { lat: r.clinic_lat, lng: r.clinic_lng } }
        : null,
    price: r.price_appointment ?? 0,
    homeExtra: r.price_home_extra,
    finalAmount: r.final_amount,
    paymentStatus: r.payment_status,
    cancelledBy: r.cancelled_by,
  }));
}

// ── Vet ──────────────────────────────────────────────

export async function loadSchedule(vetId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from('vet_schedule')
    .select('id, weekday, start_time, end_time, place')
    .eq('vet_id', vetId)
    .order('weekday')
    .order('start_time');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    weekday: r.weekday as number,
    startTime: String(r.start_time).slice(0, 5),
    endTime: String(r.end_time).slice(0, 5),
    place: r.place as Place,
  }));
}

export async function addScheduleRow(vetId: string, row: Omit<ScheduleRow, 'id'>): Promise<void> {
  const { error } = await supabase.from('vet_schedule').insert({
    vet_id: vetId,
    weekday: row.weekday,
    start_time: row.startTime,
    end_time: row.endTime,
    place: row.place,
  });
  if (error) throw error;
}

export async function removeScheduleRow(id: string): Promise<void> {
  const { error } = await supabase.from('vet_schedule').delete().eq('id', id);
  if (error) throw error;
}

export async function saveSlotMinutes(vetId: string, minutes: number): Promise<void> {
  const { error } = await supabase.from('vets').update({ slot_minutes: minutes }).eq('profile_id', vetId);
  if (error) throw error;
}

export async function loadAppointmentSettings(vetId: string): Promise<{ slotMinutes: number; price: number | null }> {
  const { data, error } = await supabase.from('vets').select('slot_minutes, price_appointment').eq('profile_id', vetId).maybeSingle();
  if (error) throw error;
  return { slotMinutes: data?.slot_minutes ?? 30, price: data?.price_appointment ?? null };
}

export type VetAppointment = {
  id: string;
  startsAt: Date;
  place: Place;
  status: AppointmentStatus;
  reason: string | null;
  name: string;
  phone: string;
  coords: { lat: number; lng: number } | null;
  reference: string | null;
  createdBy: 'owner' | 'vet';
  cancelledBy: 'owner' | 'vet' | null;
  finalAmount: number | null;
  paymentStatus: PaymentStatus;
};

export async function getVetAppointments(): Promise<VetAppointment[]> {
  const rows = await rpc<
    {
      id: string;
      starts_at: string;
      place: Place;
      status: AppointmentStatus;
      reason: string | null;
      contact_name: string;
      contact_phone: string | null;
      lat: number | null;
      lng: number | null;
      reference: string | null;
      created_by: 'owner' | 'vet';
      cancelled_by: 'owner' | 'vet' | null;
      final_amount: number | null;
      payment_status: PaymentStatus;
    }[]
  >('get_vet_appointments');
  return (rows ?? []).map((r) => ({
    id: r.id,
    startsAt: new Date(r.starts_at),
    place: r.place,
    status: r.status,
    reason: r.reason,
    name: r.contact_name,
    phone: r.contact_phone ?? '',
    coords: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null,
    reference: r.reference,
    createdBy: r.created_by,
    cancelledBy: r.cancelled_by,
    finalAmount: r.final_amount,
    paymentStatus: r.payment_status,
  }));
}

export async function addManualAppointment(a: { startsAt: Date; place: Place; name: string; phone: string; note: string }): Promise<void> {
  await rpc<string>('add_manual_appointment', {
    p_starts_at: a.startsAt.toISOString(),
    p_place: a.place,
    p_name: a.name,
    p_phone: a.phone || null,
    p_note: a.note || null,
  });
}

export async function cancelAppointment(id: string): Promise<void> {
  await rpc<null>('cancel_appointment', { p_appointment_id: id });
}

export async function finishAppointment(id: string, amount: number): Promise<void> {
  await rpc<null>('finish_appointment', { p_appointment_id: id, p_amount: amount });
}

export async function setAppointmentPayment(id: string, status: 'pending' | 'paid'): Promise<void> {
  await rpc<null>('set_appointment_payment', { p_appointment_id: id, p_status: status });
}

/** What to pay for a finished appointment (owner only). Same shape as an emergency's payment. */
export async function getAppointmentPayment(id: string): Promise<import('@/features/emergency/api').PaymentDetails | null> {
  const rows = await rpc<
    {
      vet_name: string;
      vet_phone: string | null;
      final_amount: number | null;
      payment_status: 'pending' | 'paid';
      bank_alias: string | null;
      bank_cbu_cvu: string | null;
      bank_holder: string | null;
      bank_name: string | null;
    }[]
  >('get_appointment_payment', { p_appointment_id: id });
  const r = rows?.[0];
  if (!r) return null;
  return {
    vetName: r.vet_name,
    vetPhone: r.vet_phone ?? '',
    finalAmount: r.final_amount ?? 0,
    paymentStatus: r.payment_status,
    bank: { alias: r.bank_alias ?? '', cbuCvu: r.bank_cbu_cvu ?? '', holder: r.bank_holder ?? '', bankName: r.bank_name ?? '' },
  };
}
