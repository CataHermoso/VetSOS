import { useKeepAwake } from 'expo-keep-awake';

/**
 * While this is on screen, the phone doesn't lock itself.
 * Used while a vet is on call: if the phone locks, the app stops and emergencies can't reach them.
 */
export function KeepScreenOn({ tag }: { tag: string }) {
  useKeepAwake(tag);
  return null;
}
