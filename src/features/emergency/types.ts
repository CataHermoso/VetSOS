import { Coords } from '@/lib/geo';

export type ServiceMode = 'home' | 'clinic' | 'both';

export type RejectReason = 'busy_30' | 'unavailable_today' | 'too_far' | 'timeout';

export const REJECT_REASON_TEXT: Record<RejectReason, string> = {
  busy_30: 'Está ocupado/a. Podría atender en unos 30 minutos.',
  unavailable_today: 'No está disponible hoy.',
  too_far: 'Le queda demasiado lejos.',
  timeout: 'No respondió a tiempo.',
};

export type VetCandidate = {
  id: string;
  name: string;
  phone: string;
  serviceMode: ServiceMode;
  /** Where the vet is now (for distance). */
  coords: Coords;
  /** Clinic address, if they have one. */
  clinic?: { address: string; coords: Coords };
  /** Max distance for home visits. */
  maxHomeKm: number;
  prices: { base: number; homeExtra: number; nightExtra: number };
};

export type SearchRequest = {
  coords: Coords;
  hasTransport: boolean;
};

export type SearchState =
  | { phase: 'contacting'; vet: VetCandidate; distanceKm: number; secondsLeft: number; radiusKm: number }
  | { phase: 'rejected'; vet: VetCandidate; reason: RejectReason; radiusKm: number }
  | {
      phase: 'none_left';
      radiusKm: number;
      /** Next radius for "Ampliar búsqueda", or null if we're already at the max. */
      nextRadiusKm: number | null;
      lastRejection?: { vet: VetCandidate; reason: RejectReason };
    }
  | { phase: 'accepted'; vet: VetCandidate; distanceKm: number };

/** Where owner and vet meet, based on transport and how the vet works. */
export function meetingPlace(vet: VetCandidate, hasTransport: boolean): 'clinic' | 'home' {
  return hasTransport && vet.clinic && vet.serviceMode !== 'home' ? 'clinic' : 'home';
}
