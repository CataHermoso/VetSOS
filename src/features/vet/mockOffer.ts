// FAKE incoming emergencies, for trying the vet screens alone (development only).
// Real offers arrive through useIncomingOffers. Phone numbers use 0000 so nobody real gets called.

import { config } from '@/config';
import { Coords, offsetCoords } from '@/lib/geo';

import { VetOffer } from './types';
import { VetProfile, doesHomeVisits, hasClinic } from './vetData';

type MockOwner = { firstName: string; phone: string; reference: string };

const OWNERS: MockOwner[] = [
  { firstName: 'Martina', phone: '11 0000-0101', reference: 'Casa con portón verde (dirección de prueba)' },
  { firstName: 'Julián', phone: '11 0000-0102', reference: 'Edificio, 4° B, timbre que no anda (dirección de prueba)' },
  { firstName: 'Sofía', phone: '11 0000-0103', reference: '' },
];

let count = 0;

/**
 * A compatible emergency near the vet: an owner without transport only goes to
 * vets who do home visits, and stays within their max distance.
 */
export function mockOfferFor(profile: VetProfile, vetCoords: Coords): VetOffer {
  const n = count++;
  const owner = OWNERS[n % OWNERS.length];

  const canGoHome = doesHomeVisits(profile.serviceMode);
  const canReceive = hasClinic(profile.serviceMode) && profile.clinicCoords !== null;
  // "both": alternate between an owner who can come and one who can't.
  const hasTransport = !canGoHome ? true : !canReceive ? false : n % 2 === 0;

  const km = Math.min(3.4 + n * 1.3, Math.max(1, profile.maxHomeKm * 0.8));
  return {
    id: `mock-offer-${n}`,
    emergencyId: null,
    ownerFirstName: owner.firstName,
    area: null,
    hasTransport,
    distanceKm: km,
    place: hasTransport && canReceive ? 'clinic' : 'home',
    deadline: Date.now() + config.offerTimeoutSeconds * 1000,
    mockDetails: {
      ownerPhone: owner.phone,
      ownerCoords: offsetCoords(vetCoords, km, 60 + n * 70),
      reference: owner.reference,
    },
  };
}
