import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { OfferRow } from '@/features/emergency/api';
import { supabase } from '@/lib/supabase';

import { fetchOpenOffer, touchVet } from './api';

// Safety net in case a live update gets lost (bad signal, phone asleep).
const POLL_MS = 5000;
// "Still here" signal. The server stops offering to vets not seen for 3 minutes.
const HEARTBEAT_MS = 60_000;

/**
 * While the vet is on call with the app open: tells the server they're still here,
 * and calls onOffer once for each new emergency offered to them.
 * Offers arrive live through Supabase Realtime, with a regular re-check as backup.
 */
export function useIncomingOffers(userId: string | null, enabled: boolean, onOffer: (offer: OfferRow) => void) {
  const onOfferRef = useRef(onOffer);
  useEffect(() => {
    onOfferRef.current = onOffer;
  }, [onOffer]);

  useEffect(() => {
    if (!userId || !enabled) return;
    const seen = new Set<string>();
    const deliver = (row: OfferRow | null) => {
      if (!row || row.response !== null || seen.has(row.id)) return;
      seen.add(row.id);
      onOfferRef.current(row);
    };
    const check = () => fetchOpenOffer(userId).then(deliver).catch(() => {});
    const heartbeat = () => touchVet(userId).catch(() => {});

    const channel = supabase
      .channel(`offers-for-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emergency_offers', filter: `vet_id=eq.${userId}` }, (payload) =>
        deliver(payload.new as OfferRow),
      )
      .subscribe();

    heartbeat();
    check();
    const poll = setInterval(check, POLL_MS);
    const beat = setInterval(heartbeat, HEARTBEAT_MS);
    // Coming back to the app: say hi and look for anything that arrived meanwhile.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        heartbeat();
        check();
      }
    });

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(beat);
      sub.remove();
    };
  }, [userId, enabled]);
}
