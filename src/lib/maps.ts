import { Linking, Platform } from 'react-native';

import { Coords } from './geo';

/** Directions in the phone's maps app (Apple Maps on iPhone, Google Maps elsewhere). */
export function openInMaps({ lat, lng }: Coords) {
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  Linking.openURL(url);
}

/** Start a normal phone call. */
export function callPhone(phone: string) {
  Linking.openURL(`tel:${phone.replace(/\D/g, '')}`);
}
