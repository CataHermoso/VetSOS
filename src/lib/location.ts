import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { Coords } from './geo';

export type LocationResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: 'denied' | 'unavailable' };

/** Ask permission (first time only) and read the phone's current position. */
export async function getCurrentCoords(): Promise<LocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'denied' };

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { ok: true, coords: { lat: position.coords.latitude, lng: position.coords.longitude } };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** Neighbourhood or city for "Estás en …". Phones only; returns null on web. */
export async function describeArea(coords: Coords): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const [place] = await Location.reverseGeocodeAsync({
      latitude: coords.lat,
      longitude: coords.lng,
    });
    return place?.district || place?.city || place?.subregion || place?.region || null;
  } catch {
    return null;
  }
}

/** Address text → coordinates. Phones only; returns null on web or if not found. */
export async function findAddress(address: string): Promise<Coords | null> {
  if (Platform.OS === 'web') return null;
  try {
    const [match] = await Location.geocodeAsync(address);
    return match ? { lat: match.latitude, lng: match.longitude } : null;
  } catch {
    return null;
  }
}
