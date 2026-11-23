// The emergency offered to / handled by this vet, kept in memory between screens.
// Locations never go into the URL. For real emergencies the server is the source of truth;
// this is just what the open screens need (and it's restored from the server after a restart).

import { Prices } from '@/features/emergency/prices';
import { Coords } from '@/lib/geo';

import { CaseDetails, VetOffer } from './types';
import { VetProfile } from './vetData';

export type PaymentStatus = 'pending' | 'paid';

/** What the case screens need from the vet's own profile, frozen when the offer arrives. */
export type VetSnapshot = {
  prices: Prices;
  clinicAddress: string;
  clinicCoords: Coords | null;
  bank: VetProfile['bank'];
};

export type VetCase = {
  offer: VetOffer;
  vet: VetSnapshot;
  /** Set once accepted. */
  details?: CaseDetails;
  acceptedAt?: Date;
  finalAmount?: number;
  payment?: PaymentStatus;
};

let current: VetCase | null = null;

export function snapshotOf(p: VetProfile): VetSnapshot {
  return {
    prices: { base: p.prices.base ?? 0, homeExtra: p.prices.homeExtra ?? 0, nightExtra: p.prices.nightExtra ?? 0 },
    clinicAddress: p.clinicAddress,
    clinicCoords: p.clinicCoords,
    bank: p.bank,
  };
}

export const currentCase = {
  offer(offer: VetOffer, vet: VetSnapshot) {
    current = { offer, vet };
  },
  /** An accepted case loaded back from the server (e.g. after the app was closed). */
  restore(c: VetCase) {
    current = c;
  },
  get(): VetCase | null {
    return current;
  },
  accept(details: CaseDetails, acceptedAt = new Date()) {
    if (current) current = { ...current, details, acceptedAt };
  },
  finish(finalAmount: number) {
    if (current) current = { ...current, finalAmount, payment: 'pending' };
  },
  setPayment(payment: PaymentStatus) {
    if (current) current = { ...current, payment };
  },
  clear() {
    current = null;
  },
};
