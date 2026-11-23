import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

/**
 * While this is on screen, the phone doesn't lock itself.
 * Used while a vet is on call: if the phone locks, the app stops and emergencies can't reach them.
 * Best effort: some browsers refuse (e.g. a tab in the background), and that's fine.
 */
export function KeepScreenOn({ tag }: { tag: string }) {
  useEffect(() => {
    activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [tag]);
  return null;
}
