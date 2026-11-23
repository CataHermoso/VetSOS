import { EmergencyRow, getAssignedVet } from './api';
import { currentEmergency } from './currentEmergency';

/**
 * Puts an emergency from the server back on this phone (e.g. the app was closed while
 * the vet was on the way) and says which screen to open.
 */
export async function resumeOwnerEmergency(row: EmergencyRow): Promise<'/owner/accepted' | '/owner/payment' | null> {
  const assigned = await getAssignedVet(row.id);
  if (!assigned) return null;
  currentEmergency.start({ coords: { lat: row.lat, lng: row.lng }, hasTransport: row.has_transport, mode: 'live', emergencyId: row.id });
  currentEmergency.setAccepted(assigned.vet, assigned.distanceKm, assigned.place);
  return row.status === 'finished' ? '/owner/payment' : '/owner/accepted';
}
