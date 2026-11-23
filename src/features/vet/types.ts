import { Place } from '@/features/emergency/types';
import { Coords } from '@/lib/geo';

/** An emergency offered to this vet: only what they need to decide. */
export type VetOffer = {
  id: string;
  /** The emergency on the server, or null for a simulated offer. */
  emergencyId: string | null;
  ownerFirstName: string;
  /** Neighbourhood, if the owner's phone could tell. */
  area: string | null;
  hasTransport: boolean;
  distanceKm: number;
  /** Where they'd meet: the vet's clinic or the owner's location. */
  place: Place;
  /** Local time (ms) when the answer window closes. */
  deadline: number;
  /** Simulated offers carry the details a real one only reveals after accepting. */
  mockDetails?: CaseDetails;
};

/** What the vet gets only after accepting. */
export type CaseDetails = {
  ownerPhone: string;
  ownerCoords: Coords;
  /** Address details / reference the owner typed (may be empty). */
  reference: string;
};

export type VetRejectReason = 'busy_30' | 'unavailable_today' | 'too_far';

export const VET_REJECT_OPTIONS: { value: VetRejectReason; label: string; effect: string }[] = [
  { value: 'busy_30', label: 'Ocupado, en 30 min puedo', effect: 'No te llegan urgencias por 30 minutos.' },
  { value: 'unavailable_today', label: 'No disponible hoy', effect: 'Te ponemos como No disponible.' },
  { value: 'too_far', label: 'Muy lejos', effect: 'Seguís de guardia para otras urgencias.' },
];
