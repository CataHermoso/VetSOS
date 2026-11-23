import { Linking } from 'react-native';

import { Coords } from './geo';

/**
 * Directions in Google Maps, on every phone. This link opens the Google Maps app
 * if it's installed (iPhone and Android), or Google Maps in the browser if not.
 */
export function openInMaps({ lat, lng }: Coords) {
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
}

/** Start a normal phone call. */
export function callPhone(phone: string) {
  Linking.openURL(`tel:${phone.replace(/\D/g, '')}`);
}
