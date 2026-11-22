// The emergency in progress, kept in memory and passed between screens.
// Locations never go into the URL: on web they would show up in history and logs.
// Milestone 5 replaces this with the emergency row in Supabase (only its id is passed).

import { Coords } from '@/lib/geo';

import { MockScenario } from './mockVets';
import { VetCandidate } from './types';

export type CurrentEmergency = {
  coords: Coords;
  hasTransport: boolean;
  scenario: MockScenario;
  accepted?: { vet: VetCandidate; distanceKm: number };
};

let current: CurrentEmergency | null = null;

export const currentEmergency = {
  start(e: Omit<CurrentEmergency, 'accepted'>) {
    current = { ...e };
  },
  get(): CurrentEmergency | null {
    return current;
  },
  setAccepted(vet: VetCandidate, distanceKm: number) {
    if (current) current = { ...current, accepted: { vet, distanceKm } };
  },
  clear() {
    current = null;
  },
};
