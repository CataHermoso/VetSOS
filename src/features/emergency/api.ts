// Server calls for real emergencies (see supabase/migrations/20261123000000_emergencies_and_offers.sql).
// Every change goes through a database function that checks who is calling.

import { Coords } from '@/lib/geo';
import { supabase } from '@/lib/supabase';

import { Place, RejectReason, ServiceMode, VetCandidate } from './types';

/** One row of emergency_offers: an emergency offered to one vet. */
export type OfferRow = {
  id: string;
  emergency_id: string;
  vet_id: string;
  vet_name: string;
  owner_first_name: string;
  area: string | null;
  has_transport: boolean;
  place: Place;
  distance_km: number;
  sent_at: string;
  expires_at: string;
  response: 'accepted' | 'rejected' | 'timeout' | 'cancelled' | null;
  reason: Exclude<RejectReason, 'timeout'> | null;
  responded_at: string | null;
};

/**
 * Seconds left to answer, counted on this phone's clock from the moment the offer
 * was first seen. Uses the server's answer window but never trusts the phone's clock
 * to be in sync with the server's.
 */
export function offerDeadline(offer: OfferRow, seenAt = Date.now()): number {
  const answerWindow = Date.parse(offer.expires_at) - Date.parse(offer.sent_at);
  const byServerClock = Date.parse(offer.expires_at) - seenAt;
  // If the clocks agree, the difference is just how long the offer took to arrive (a few seconds):
  // use it so we don't promise more time than the server gives. If they clearly disagree, ignore the clock.
  const delay = answerWindow - byServerClock;
  return seenAt + (delay >= 0 && delay <= 10_000 ? byServerClock : answerWindow);
}

/** Server errors raised on purpose → words people understand. */
export function apiErrorMessage(e: unknown): string {
  const text = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (text.includes('not_owner')) return 'Esta cuenta está en modo veterinario. Tocá "Cambiar de modo" y elegí "Tengo una mascota".';
  if (text.includes('not_found')) return 'No encontramos esta urgencia. Volvé a empezar desde el inicio.';
  if (text.includes('Failed to fetch') || text.includes('Network')) return 'No hay conexión. Revisá internet y probá de nuevo.';
  return text || 'Algo salió mal. Probá de nuevo.';
}

function first<T>(rows: unknown): T | null {
  return Array.isArray(rows) && rows.length > 0 ? (rows[0] as T) : null;
}

// ── Owner ──────────────────────────────────────────────

export async function createEmergency(coords: Coords, hasTransport: boolean, area: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('create_emergency', {
    p_lat: coords.lat,
    p_lng: coords.lng,
    p_has_transport: hasTransport,
    p_area: area,
  });
  if (error) throw error;
  return data as string;
}

/** Ask the next vet. Null = nobody left within this radius. */
export async function offerNext(emergencyId: string, radiusKm: number): Promise<OfferRow | null> {
  const { data, error } = await supabase.rpc('offer_next', { p_emergency_id: emergencyId, p_radius_km: radiusKm });
  if (error) throw error;
  return first<OfferRow>(data);
}

export async function fetchOffer(offerId: string): Promise<OfferRow | null> {
  const { data, error } = await supabase.from('emergency_offers').select('*').eq('id', offerId).maybeSingle();
  if (error) throw error;
  return data as OfferRow | null;
}

/** The owner's countdown ran out: let the server close the offer if it really expired. */
export async function expireOffer(offerId: string): Promise<OfferRow | null> {
  const { data, error } = await supabase.rpc('expire_offer', { p_offer_id: offerId });
  if (error) throw error;
  return first<OfferRow>(data);
}

export async function cancelEmergency(emergencyId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_emergency', { p_emergency_id: emergencyId });
  if (error) throw error;
}

type AssignedVetRow = {
  vet_id: string;
  full_name: string | null;
  phone: string | null;
  service_mode: ServiceMode;
  clinic_address: string | null;
  clinic_lat: number | null;
  clinic_lng: number | null;
  max_home_km: number;
  price_base: number | null;
  price_home_extra: number | null;
  price_night_extra: number | null;
  place: Place;
  distance_km: number;
};

/** Who accepted, with phone and prices. Only works once a vet accepted. */
export async function getAssignedVet(
  emergencyId: string,
): Promise<{ vet: VetCandidate; distanceKm: number; place: Place } | null> {
  const { data, error } = await supabase.rpc('get_assigned_vet', { p_emergency_id: emergencyId });
  if (error) throw error;
  const r = first<AssignedVetRow>(data);
  if (!r) return null;
  return {
    vet: {
      id: r.vet_id,
      name: r.full_name?.trim() || 'Veterinario/a',
      phone: r.phone ?? '',
      serviceMode: r.service_mode,
      clinic:
        r.clinic_address && r.clinic_lat != null && r.clinic_lng != null
          ? { address: r.clinic_address, coords: { lat: r.clinic_lat, lng: r.clinic_lng } }
          : undefined,
      maxHomeKm: r.max_home_km,
      prices: { base: r.price_base ?? 0, homeExtra: r.price_home_extra ?? 0, nightExtra: r.price_night_extra ?? 0 },
    },
    distanceKm: r.distance_km,
    place: r.place,
  };
}
