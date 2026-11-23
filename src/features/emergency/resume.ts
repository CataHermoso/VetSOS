import { EmergencyRow, getAssignedVet } from './api';
import { currentEmergency } from './currentEmergency';

type ResumeRoute = '/owner/accepted' | '/owner/payment' | '/owner/search';

/**
 * Puts an emergency from the server back on this phone (e.g. the app was closed while
 * the vet was on the way) and says which screen to open.
 */
export async function resumeOwnerEmergency(row: EmergencyRow): Promise<ResumeRoute | null> {
  const base = { coords: { lat: row.lat, lng: row.lng }, hasTransport: row.has_transport, mode: 'live' as const, emergencyId: row.id };

  // Still searching (closed mid-search, or the vet couldn't go): carry on with the search.
  if (row.status === 'searching' || row.status === 'offered') {
    currentEmergency.start(base);
    return '/owner/search';
  }

  const assigned = await getAssignedVet(row.id);
  if (!assigned) return null;
  currentEmergency.start(base);
  currentEmergency.setAccepted(assigned.vet, assigned.distanceKm, assigned.place);
  return row.status === 'finished' ? '/owner/payment' : '/owner/accepted';
}
