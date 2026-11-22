// The emergency offered to / handled by this vet, kept in memory between screens.
// Locations never go into the URL. Milestone 5 replaces this with the emergency row in Supabase.

import { Prices } from '@/features/emergency/prices';
import { Coords } from '@/lib/geo';

import { VetOffer } from './types';
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
  get(): VetCase | null {
    return current;
  },
  accept() {
    if (current) current = { ...current, acceptedAt: new Date() };
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
