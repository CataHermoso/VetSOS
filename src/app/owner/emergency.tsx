import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { LoadingScreen, MessageScreen } from '@/components/StatusScreens';
import { isOwnerSetupComplete, loadOwnerData } from '@/features/owner/ownerData';
import { errorMessage, useSession } from '@/lib/session';

// Entry point of the emergency button: first time → setup, otherwise → confirm.
export default function EmergencyEntry() {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadOwnerData(userId)
      .then((data) => {
        if (!cancelled) router.replace(isOwnerSetupComplete(data) ? '/owner/confirm' : '/owner/setup');
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  if (error) {
    return (
      <MessageScreen
        title="No pudimos cargar tus datos"
        message={error}
        actionLabel="Reintentar"
        onAction={() => {
          setError(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  return <LoadingScreen />;
}
