import { Coords } from '@/lib/geo';

export type ServiceMode = 'home' | 'clinic' | 'both';

export type Place = 'clinic' | 'home';

export type RejectReason = 'busy_30' | 'unavailable_today' | 'too_far' | 'timeout';

export const REJECT_REASON_TEXT: Record<RejectReason, string> = {
  busy_30: 'Está ocupado/a. Podría atender en unos 30 minutos.',
  unavailable_today: 'No está disponible hoy.',
  too_far: 'Le queda demasiado lejos.',
  timeout: 'No respondió a tiempo.',
};

/** A vet as the owner sees them once they accept: who, how to reach them, what they charge. */
export type VetCandidate = {
  id: string;
  name: string;
  phone: string;
  serviceMode: ServiceMode;
  /** Clinic address, if they have one. */
  clinic?: { address: string; coords: Coords };
  /** Max distance for home visits. */
  maxHomeKm: number;
  prices: { base: number; homeExtra: number; nightExtra: number };
};

/** While deciding, the owner only knows the vet's name. */
export type VetRef = { id: string; name: string };

/** How the owner wants the search to run. "live" = real vets; the others are simulations for development. */
export type SearchMode = 'live' | 'mock_accept' | 'mock_nobody';

export type SearchRequest = {
  coords: Coords;
  hasTransport: boolean;
};

export type SearchState =
  | { phase: 'contacting'; vet: VetRef; distanceKm: number; secondsLeft: number; radiusKm: number }
  | { phase: 'rejected'; vet: VetRef; reason: RejectReason; radiusKm: number }
  | {
      phase: 'none_left';
      radiusKm: number;
      /** Next radius for "Ampliar búsqueda", or null if we're already at the max. */
      nextRadiusKm: number | null;
      lastRejection?: { vet: VetRef; reason: RejectReason };
    }
  | { phase: 'accepted'; vet: VetCandidate; distanceKm: number; place: Place }
  /** Something went wrong talking to the server. */
  | { phase: 'error'; message: string };

/** What every search (real or simulated) gives the search screen. */
export type SearchControls = {
  state: SearchState | null;
  tryNext: () => void;
  expandRadius: () => void;
  /** Stop searching (the owner cancelled or left). */
  stop: () => void;
  retry: () => void;
};

/** Where owner and vet meet, based on transport and how the vet works. */
export function meetingPlace(vet: VetCandidate, hasTransport: boolean): Place {
  return hasTransport && vet.clinic && vet.serviceMode !== 'home' ? 'clinic' : 'home';
}
