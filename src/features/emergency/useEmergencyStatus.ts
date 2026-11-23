import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { EmergencyRow, fetchEmergency } from './api';

// Safety net in case a live update gets lost.
const POLL_MS = 5000;

/**
 * Follows one emergency live (status and payment): Supabase Realtime plus a regular re-check.
 * Pass undefined to do nothing (e.g. a simulated emergency).
 */
export function useEmergencyStatus(emergencyId: string | undefined): EmergencyRow | null {
  const [row, setRow] = useState<EmergencyRow | null>(null);

  useEffect(() => {
    if (!emergencyId) return;
    let alive = true;
    const update = (r: EmergencyRow | null) => {
      if (alive && r) setRow(r);
    };
    const check = () => fetchEmergency(emergencyId).then(update).catch(() => {});

    const channel = supabase
      .channel(`emergency-${emergencyId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'emergencies', filter: `id=eq.${emergencyId}` }, () => check())
      .subscribe();

    check();
    const poll = setInterval(check, POLL_MS);
    return () => {
      alive = false;
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [emergencyId]);

  return row;
}
