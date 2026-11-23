// The emergency in progress on the owner's phone, passed between screens in memory.
// Locations never go into the URL: on web they would show up in history and logs.
// For a real search the emergency also lives in Supabase (emergencyId).

import { Coords } from '@/lib/geo';

import { Place, SearchMode, VetCandidate } from './types';

export type CurrentEmergency = {
  coords: Coords;
  hasTransport: boolean;
  mode: SearchMode;
  /** Row in the emergencies table (real searches only). */
  emergencyId?: string;
  accepted?: { vet: VetCandidate; distanceKm: number; place: Place };
};

let current: CurrentEmergency | null = null;

export const currentEmergency = {
  start(e: Omit<CurrentEmergency, 'accepted'>) {
    current = { ...e };
  },
  get(): CurrentEmergency | null {
    return current;
  },
  setAccepted(vet: VetCandidate, distanceKm: number, place: Place) {
    if (current) current = { ...current, accepted: { vet, distanceKm, place } };
  },
  clear() {
    current = null;
  },
};
