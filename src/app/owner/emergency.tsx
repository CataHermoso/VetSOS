import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { LoadingScreen, MessageScreen } from '@/components/StatusScreens';
import { isOwnerSetupComplete, loadOwnerData } from '@/features/owner/ownerData';
import { errorMessage, useSession } from '@/lib/session';

// Entry point of the emergency button: first time → setup, otherwise → confirm.
export default function EmergencyEntry() {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;
  const [error, setError] = useState<string | null>(null);

  const route = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const data = await loadOwnerData(userId);
      router.replace(isOwnerSetupComplete(data) ? '/owner/confirm' : '/owner/setup');
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [userId]);

  useEffect(() => {
    route();
  }, [route]);

  if (error) {
    return <MessageScreen title="No pudimos cargar tus datos" message={error} actionLabel="Reintentar" onAction={route} />;
  }
  return <LoadingScreen />;
}
