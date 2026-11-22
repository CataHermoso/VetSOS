// FAKE vets for milestone 3. Milestone 5 replaces this with real vets from Supabase.
// They are placed around wherever the owner is, so distances make sense anywhere.
// Phone numbers are deliberately invalid (0000) so nobody real gets called.

import { Coords, offsetCoords } from '@/lib/geo';

import { RejectReason, ServiceMode, VetCandidate } from './types';

export type MockScenario = 'normal' | 'nobody';

type MockResponse = { kind: 'accept'; afterMs: number } | { kind: 'reject'; reason: RejectReason; afterMs: number } | { kind: 'timeout' };

type MockVetSpec = {
  id: string;
  name: string;
  serviceMode: ServiceMode;
  km: number;
  bearing: number;
  clinicAddress?: string;
  maxHomeKm: number;
  prices: VetCandidate['prices'];
  response: MockResponse;
};

/*
 * Scenario "normal":
 *  - With transport:    Méndez rejects → Sosa doesn't answer → Ríos (clinic) accepts.
 *  - Without transport: Méndez rejects → Sosa doesn't answer → nobody left in 10 km
 *                       → "Ampliar búsqueda" → Luna (home visits, 18 km) accepts.
 * Scenario "nobody": everyone rejects → ends in the list of clinics outside the network.
 */
const SPECS: MockVetSpec[] = [
  {
    id: 'mock-mendez',
    name: 'Dra. Laura Méndez',
    serviceMode: 'both',
    km: 2.1,
    bearing: 40,
    clinicAddress: 'Av. Ejemplo 1200 (consultorio de prueba)',
    maxHomeKm: 10,
    prices: { base: 25000, homeExtra: 10000, nightExtra: 8000 },
    response: { kind: 'reject', reason: 'busy_30', afterMs: 3000 },
  },
  {
    id: 'mock-sosa',
    name: 'Dr. Martín Sosa',
    serviceMode: 'home',
    km: 4.5,
    bearing: 160,
    maxHomeKm: 15,
    prices: { base: 22000, homeExtra: 12000, nightExtra: 10000 },
    response: { kind: 'timeout' },
  },
  {
    id: 'mock-rios',
    name: 'Dra. Paula Ríos',
    serviceMode: 'clinic',
    km: 6.8,
    bearing: 280,
    clinicAddress: 'Calle de Prueba 456 (consultorio de prueba)',
    maxHomeKm: 1,
    prices: { base: 20000, homeExtra: 0, nightExtra: 6000 },
    response: { kind: 'accept', afterMs: 4000 },
  },
  {
    id: 'mock-luna',
    name: 'Dr. Federico Luna',
    serviceMode: 'both',
    km: 18,
    bearing: 90,
    clinicAddress: 'Ruta de Ejemplo km 50 (consultorio de prueba)',
    maxHomeKm: 25,
    prices: { base: 28000, homeExtra: 15000, nightExtra: 9000 },
    response: { kind: 'accept', afterMs: 4000 },
  },
  {
    id: 'mock-paz',
    name: 'Dra. Sofía Paz',
    serviceMode: 'home',
    km: 42,
    bearing: 200,
    maxHomeKm: 50,
    prices: { base: 30000, homeExtra: 20000, nightExtra: 12000 },
    response: { kind: 'reject', reason: 'unavailable_today', afterMs: 3000 },
  },
];

/** Mock vets answer faster than real ones so testing doesn't take forever. */
export const MOCK_OFFER_TIMEOUT_SECONDS = 10;

export function mockVetsAround(origin: Coords): VetCandidate[] {
  return SPECS.map((spec, i) => {
    const coords = offsetCoords(origin, spec.km, spec.bearing);
    return {
      id: spec.id,
      name: spec.name,
      phone: `11 0000-000${i + 1}`,
      serviceMode: spec.serviceMode,
      coords,
      clinic: spec.clinicAddress ? { address: spec.clinicAddress, coords } : undefined,
      maxHomeKm: spec.maxHomeKm,
      prices: spec.prices,
    };
  });
}

export function mockResponseFor(vetId: string, scenario: MockScenario): MockResponse {
  const spec = SPECS.find((s) => s.id === vetId);
  if (!spec) return { kind: 'timeout' };
  if (scenario === 'nobody') return { kind: 'reject', reason: 'unavailable_today', afterMs: 2000 };
  return spec.response;
}

/** Known emergency clinics outside the network (fake for now). */
export const MOCK_KNOWN_CLINICS = [
  { name: 'Guardia Veterinaria Ejemplo Norte', area: 'Clínica 24 h (de prueba)', phone: '11 0000-1001' },
  { name: 'Hospital Veterinario de Prueba', area: 'Clínica 24 h (de prueba)', phone: '11 0000-1002' },
];
