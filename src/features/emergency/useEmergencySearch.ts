import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { config } from '@/config';
import { distanceKm } from '@/lib/geo';

import { MockScenario, MOCK_OFFER_TIMEOUT_SECONDS, mockResponseFor, mockVetsAround } from './mockVets';
import { RejectReason, SearchRequest, SearchState, VetCandidate } from './types';

/**
 * Runs an emergency search: offers it to one vet at a time, nearest first.
 * - A vet who rejects or doesn't answer is never offered the same emergency again.
 * - The owner decides when to try the next vet (not automatic).
 * - When nobody is left in the radius, the owner can widen it.
 *
 * MILESTONE 3: answers are simulated (mockVets.ts). Milestone 5 swaps the
 * inside of this hook for Supabase realtime; the screens stay the same.
 */
export function useEmergencySearch(request: SearchRequest, scenario: MockScenario) {
  const { lat, lng } = request.coords;
  const { hasTransport } = request;

  const vets = useMemo(() => mockVetsAround({ lat, lng }), [lat, lng]);
  const [state, setState] = useState<SearchState | null>(null);

  const contacted = useRef(new Set<string>());
  const radiusIndex = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  }, []);

  const distanceTo = useCallback((vet: VetCandidate) => distanceKm({ lat, lng }, vet.coords), [lat, lng]);

  const findNextVet = useCallback(
    (radiusKm: number) =>
      vets
        .filter((vet) => !contacted.current.has(vet.id))
        .map((vet) => ({ vet, km: distanceTo(vet) }))
        .filter(({ vet, km }) => {
          if (km > radiusKm) return false;
          // No transport → only vets who visit homes, within their own max distance.
          if (!hasTransport) return vet.serviceMode !== 'clinic' && km <= vet.maxHomeKm;
          return true;
        })
        .sort((a, b) => a.km - b.km)[0] ?? null,
    [vets, distanceTo, hasTransport],
  );

  const contactNext = useCallback(
    (lastRejection?: { vet: VetCandidate; reason: RejectReason }) => {
      stopTimers();
      const steps = config.radiusStepsKm;
      const radiusKm = steps[radiusIndex.current];
      const next = findNextVet(radiusKm);

      if (!next) {
        setState({
          phase: 'none_left',
          radiusKm,
          nextRadiusKm: steps[radiusIndex.current + 1] ?? null,
          lastRejection,
        });
        return;
      }

      const { vet, km } = next;
      contacted.current.add(vet.id);

      const timeoutSeconds = MOCK_OFFER_TIMEOUT_SECONDS;
      const deadline = Date.now() + timeoutSeconds * 1000;
      setState({ phase: 'contacting', vet, distanceKm: km, secondsLeft: timeoutSeconds, radiusKm });

      const finishRejected = (reason: RejectReason) => {
        stopTimers();
        setState({ phase: 'rejected', vet, reason, radiusKm });
      };

      // Countdown; no answer by the deadline counts as "didn't answer".
      ticker.current = setInterval(() => {
        const secondsLeft = (deadline - Date.now()) / 1000;
        if (secondsLeft <= 0) {
          finishRejected('timeout');
        } else {
          setState((s) => (s?.phase === 'contacting' && s.vet.id === vet.id ? { ...s, secondsLeft } : s));
        }
      }, 250);

      // Simulated answer.
      const response = mockResponseFor(vet.id, scenario);
      if (response.kind === 'accept') {
        timers.current.push(
          setTimeout(() => {
            stopTimers();
            setState({ phase: 'accepted', vet, distanceKm: km });
          }, response.afterMs),
        );
      } else if (response.kind === 'reject') {
        timers.current.push(setTimeout(() => finishRejected(response.reason), response.afterMs));
      }
    },
    [findNextVet, scenario, stopTimers],
  );

  // Start searching as soon as the screen opens.
  useEffect(() => {
    contacted.current = new Set();
    radiusIndex.current = 0;
    contactNext();
    return stopTimers;
  }, [contactNext, stopTimers]);

  const tryNext = useCallback(() => {
    contactNext(state?.phase === 'rejected' ? { vet: state.vet, reason: state.reason } : undefined);
  }, [contactNext, state]);

  const expandRadius = useCallback(() => {
    if (radiusIndex.current < config.radiusStepsKm.length - 1) {
      radiusIndex.current += 1;
      contactNext();
    }
  }, [contactNext]);

  return { state, tryNext, expandRadius, stop: stopTimers };
}
