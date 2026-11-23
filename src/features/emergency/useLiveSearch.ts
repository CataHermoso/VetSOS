import { useCallback, useEffect, useRef, useState } from 'react';

import { config } from '@/config';
import { supabase } from '@/lib/supabase';

import { OfferRow, apiErrorMessage, cancelEmergency, expireOffer, fetchOffer, getAssignedVet, offerDeadline, offerNext } from './api';
import { Place, RejectReason, SearchControls, SearchState, VetCandidate, VetRef } from './types';

type Internal =
  | { kind: 'loading' }
  | { kind: 'offer'; offer: OfferRow; radiusKm: number; /** local time when the vet's answer window closes */ deadline: number }
  | { kind: 'none'; radiusKm: number; last: OfferRow | null }
  | { kind: 'accepted'; vet: VetCandidate; distanceKm: number; place: Place }
  | { kind: 'error'; message: string };

// How often we re-check the open offer, in case a live update gets lost (bad signal, phone asleep).
const POLL_MS = 4000;
// Wait this long after our countdown ends before asking the server to close the offer (it allows 2 s of grace).
const EXPIRE_AFTER_MS = 2500;

const vetOf = (o: OfferRow): VetRef => ({ id: o.vet_id, name: o.vet_name });
const reasonOf = (o: OfferRow): RejectReason => (o.response === 'timeout' ? 'timeout' : (o.reason ?? 'unavailable_today'));

/**
 * REAL emergency search against Supabase. Same rules and same screen as the simulated one:
 * the server offers the emergency to one vet at a time, nearest first; the vet's answer
 * arrives live (Supabase Realtime, with a regular re-check as a safety net).
 */
export function useLiveSearch(emergencyId: string): SearchControls {
  const [internal, setInternal] = useState<Internal>({ kind: 'loading' });
  const [now, setNow] = useState(() => Date.now());

  const radiusIndex = useRef(0);
  const deadlines = useRef(new Map<string, number>()); // offer id → local deadline
  const lastAnswered = useRef<OfferRow | null>(null);
  const stopped = useRef(false);
  const acceptedLoading = useRef(false);

  const deadlineOf = useCallback((offer: OfferRow) => {
    let d = deadlines.current.get(offer.id);
    if (d === undefined) {
      d = offerDeadline(offer);
      deadlines.current.set(offer.id, d);
    }
    return d;
  }, []);

  /** A new version of the current offer arrived (from the server, live update or re-check). */
  const applyOffer = useCallback(
    (offer: OfferRow, radiusKm: number) => {
      if (stopped.current) return;
      const deadline = deadlineOf(offer);

      if (offer.response === 'accepted') {
        if (acceptedLoading.current) return;
        acceptedLoading.current = true;
        getAssignedVet(offer.emergency_id)
          .then((a) => {
            if (stopped.current) return;
            if (a) setInternal({ kind: 'accepted', ...a });
            else setInternal({ kind: 'error', message: 'El veterinario aceptó, pero no pudimos cargar sus datos.' });
          })
          .catch((e) => {
            acceptedLoading.current = false;
            setInternal({ kind: 'error', message: apiErrorMessage(e) });
          });
        return;
      }
      if (offer.response === 'rejected' || offer.response === 'timeout') lastAnswered.current = offer;

      setInternal((s) =>
        // Ignore out-of-date copies of an older offer.
        s.kind === 'offer' && s.offer.id !== offer.id && s.offer.response === null ? s : { kind: 'offer', offer, radiusKm, deadline },
      );
    },
    [deadlineOf],
  );

  /** Ask the server for the next vet within the current radius. */
  const askNext = useCallback(async () => {
    const radiusKm = config.radiusStepsKm[radiusIndex.current];
    try {
      const offer = await offerNext(emergencyId, radiusKm);
      if (stopped.current) return;
      if (offer) applyOffer(offer, radiusKm);
      else setInternal({ kind: 'none', radiusKm, last: lastAnswered.current });
    } catch (e) {
      if (!stopped.current) setInternal({ kind: 'error', message: apiErrorMessage(e) });
    }
  }, [emergencyId, applyOffer]);

  // Start: the first vet. (Asking twice is safe: the server returns the same open offer.)
  useEffect(() => {
    stopped.current = false;
    const radiusKm = config.radiusStepsKm[0];
    offerNext(emergencyId, radiusKm)
      .then((offer) => {
        if (stopped.current) return;
        if (offer) applyOffer(offer, radiusKm);
        else setInternal({ kind: 'none', radiusKm, last: null });
      })
      .catch((e) => setInternal({ kind: 'error', message: apiErrorMessage(e) }));
  }, [emergencyId, applyOffer]);

  // While a vet is deciding: listen for their answer, re-check now and then, run the countdown.
  const open = internal.kind === 'offer' && internal.offer.response === null ? internal : null;
  const openId = open?.offer.id ?? null;
  const openRadius = open?.radiusKm ?? 0;
  const openDeadline = open?.deadline ?? 0;

  useEffect(() => {
    if (!openId) return;
    const update = (o: OfferRow | null) => {
      if (o && o.id === openId) applyOffer(o, openRadius);
    };

    const channel = supabase
      .channel(`offer-${openId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'emergency_offers', filter: `id=eq.${openId}` }, (payload) =>
        update(payload.new as OfferRow),
      )
      .subscribe();

    const poll = setInterval(() => fetchOffer(openId).then(update).catch(() => {}), POLL_MS);

    let expiring = false;
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (!expiring && t > openDeadline + EXPIRE_AFTER_MS) {
        expiring = true;
        expireOffer(openId)
          .then(update)
          .catch(() => {})
          .finally(() => {
            setTimeout(() => (expiring = false), 2000); // still open per server clock → ask again shortly
          });
      }
    }, 250);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [openId, openRadius, openDeadline, applyOffer]);

  const tryNext = useCallback(() => {
    setInternal({ kind: 'loading' });
    askNext();
  }, [askNext]);

  const expandRadius = useCallback(() => {
    if (radiusIndex.current >= config.radiusStepsKm.length - 1) return;
    radiusIndex.current += 1;
    setInternal({ kind: 'loading' });
    askNext();
  }, [askNext]);

  const stop = useCallback(() => {
    stopped.current = true;
    cancelEmergency(emergencyId).catch(() => {}); // no-op on the server if a vet already accepted
  }, [emergencyId]);

  const retry = useCallback(() => {
    setInternal({ kind: 'loading' });
    askNext();
  }, [askNext]);

  return { state: toSearchState(internal, now), tryNext, expandRadius, stop, retry };
}

function toSearchState(s: Internal, now: number): SearchState | null {
  const steps = config.radiusStepsKm;
  switch (s.kind) {
    case 'loading':
      return null;
    case 'error':
      return { phase: 'error', message: s.message };
    case 'accepted':
      return { phase: 'accepted', vet: s.vet, distanceKm: s.distanceKm, place: s.place };
    case 'none': {
      const i = (steps as readonly number[]).indexOf(s.radiusKm);
      return {
        phase: 'none_left',
        radiusKm: s.radiusKm,
        nextRadiusKm: i >= 0 && i < steps.length - 1 ? steps[i + 1] : null,
        lastRejection: s.last ? { vet: vetOf(s.last), reason: reasonOf(s.last) } : undefined,
      };
    }
    case 'offer': {
      const o = s.offer;
      if (o.response === null) {
        return {
          phase: 'contacting',
          vet: vetOf(o),
          distanceKm: o.distance_km,
          secondsLeft: Math.max(0, (s.deadline - now) / 1000),
          radiusKm: s.radiusKm,
        };
      }
      if (o.response === 'rejected' || o.response === 'timeout') {
        return { phase: 'rejected', vet: vetOf(o), reason: reasonOf(o), radiusKm: s.radiusKm };
      }
      return null; // accepted (loading the vet's details) or cancelled
    }
  }
}
