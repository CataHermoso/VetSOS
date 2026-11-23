// Server calls for the vet side of real emergencies.

import { OfferRow, offerDeadline } from '@/features/emergency/api';
import { Place } from '@/features/emergency/types';
import { supabase } from '@/lib/supabase';

import { CaseDetails, VetOffer, VetRejectReason } from './types';

export function offerFromRow(row: OfferRow, seenAt = Date.now()): VetOffer {
  return {
    id: row.id,
    emergencyId: row.emergency_id,
    ownerFirstName: row.owner_first_name,
    area: row.area,
    hasTransport: row.has_transport,
    distanceKm: row.distance_km,
    place: row.place,
    deadline: offerDeadline(row, seenAt),
  };
}

/** The offer this vet has to answer right now, if any. */
export async function fetchOpenOffer(userId: string): Promise<OfferRow | null> {
  const { data, error } = await supabase
    .from('emergency_offers')
    .select('*')
    .eq('vet_id', userId)
    .is('response', null)
    .gt('expires_at', new Date(Date.now() - 2000).toISOString())
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as OfferRow | null;
}

export type RespondResult = 'accepted' | 'rejected' | 'expired' | 'gone' | 'busy';

/** Aceptar / Rechazar. Accepting is atomic on the server: only one vet can get it. */
export async function respondOffer(offerId: string, accept: boolean, reason?: VetRejectReason): Promise<RespondResult> {
  const { data, error } = await supabase.rpc('respond_offer', {
    p_offer_id: offerId,
    p_accept: accept,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data as RespondResult;
}

type VetCaseRow = {
  emergency_id: string;
  offer_id: string;
  owner_first_name: string;
  owner_phone: string | null;
  lat: number;
  lng: number;
  area: string | null;
  reference: string | null;
  has_transport: boolean;
  place: Place;
  distance_km: number;
  accepted_at: string;
};

/** The emergency this vet accepted and hasn't finished, with the owner's contact details. */
export async function getVetCase(): Promise<{ offer: VetOffer; details: CaseDetails; acceptedAt: Date } | null> {
  const { data, error } = await supabase.rpc('get_vet_case');
  if (error) throw error;
  const r = Array.isArray(data) ? (data[0] as VetCaseRow | undefined) : undefined;
  if (!r) return null;
  return {
    offer: {
      id: r.offer_id,
      emergencyId: r.emergency_id,
      ownerFirstName: r.owner_first_name,
      area: r.area,
      hasTransport: r.has_transport,
      distanceKm: r.distance_km,
      place: r.place,
      deadline: 0,
    },
    details: {
      ownerPhone: r.owner_phone ?? '',
      ownerCoords: { lat: r.lat, lng: r.lng },
      reference: r.reference ?? '',
    },
    acceptedAt: new Date(r.accepted_at),
  };
}

export async function finishEmergency(emergencyId: string, amount: number): Promise<void> {
  const { error } = await supabase.rpc('finish_emergency', { p_emergency_id: emergencyId, p_amount: amount });
  if (error) throw error;
}

export async function setPaymentStatus(emergencyId: string, status: 'pending' | 'paid'): Promise<void> {
  const { error } = await supabase.rpc('set_payment', { p_emergency_id: emergencyId, p_status: status });
  if (error) throw error;
}

/** "I'm still here with the app open": vets who closed the app stop getting offers after a few minutes. */
export async function touchVet(userId: string): Promise<void> {
  const { error } = await supabase.from('vets').update({ last_seen_at: new Date().toISOString() }).eq('profile_id', userId);
  if (error) throw error;
}

export type PendingPayment = { emergencyId: string; ownerFirstName: string; amount: number; finishedAt: Date };

/** Cases this vet closed with the payment still pending (last 7 days). */
export async function fetchPendingPayments(userId: string): Promise<PendingPayment[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('emergencies')
    .select('id, final_amount, finished_at, emergency_offers(owner_first_name, vet_id)')
    .eq('assigned_vet_id', userId)
    .eq('status', 'finished')
    .eq('payment_status', 'pending')
    .gt('finished_at', since)
    .order('finished_at', { ascending: false });
  if (error) throw error;
  type Row = { id: string; final_amount: number | null; finished_at: string; emergency_offers: { owner_first_name: string; vet_id: string }[] };
  return ((data ?? []) as Row[]).map((r) => ({
    emergencyId: r.id,
    ownerFirstName: r.emergency_offers.find((o) => o.vet_id === userId)?.owner_first_name ?? 'Dueño/a',
    amount: r.final_amount ?? 0,
    finishedAt: new Date(r.finished_at),
  }));
}

/** "No puedo ir": give an accepted emergency back; the owner can look for another vet. */
export async function releaseEmergency(emergencyId: string): Promise<void> {
  const { error } = await supabase.rpc('release_emergency', { p_emergency_id: emergencyId });
  if (error) throw error;
}
