import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { isSupabaseConfigured, supabase } from './supabase';

export type Role = 'owner' | 'vet';

type SessionState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'error'; message: string }
  | { status: 'ready'; userId: string; role: Role | null };

type SessionContextValue = SessionState & {
  /** Save the role (creates the owner/vet row the first time). */
  setRole: (role: Role) => Promise<void>;
  retry: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Logs the user in anonymously (no email/password, nobody has to sign up
 * during an emergency) and loads their saved role.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState({ status: 'unconfigured' });
      return;
    }

    let cancelled = false;

    (async () => {
      setState({ status: 'loading' });
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        let userId = sessionData.session?.user.id;
        if (!userId) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          userId = data.user?.id;
        }
        if (!userId) throw new Error('No se pudo iniciar sesión.');

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();
        if (profileError) throw profileError;

        if (!cancelled) {
          setState({ status: 'ready', userId, role: (profile?.role as Role | undefined) ?? null });
        }
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: errorMessage(e) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const setRole = useCallback(
    async (role: Role) => {
      if (state.status !== 'ready') throw new Error('La sesión todavía no está lista.');
      const { userId } = state;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: userId, role });
      if (profileError) throw profileError;

      // Make sure the role's own row exists (keeps existing data if it does).
      const { error: rowError } =
        role === 'vet'
          ? await supabase.from('vets').upsert({ profile_id: userId }, { ignoreDuplicates: true })
          : await supabase
              .from('owner_settings')
              .upsert({ profile_id: userId }, { ignoreDuplicates: true });
      if (rowError) throw rowError;

      // Leaving vet mode ends the shift, so no emergencies arrive unseen.
      if (role === 'owner') {
        const { error: offlineError } = await supabase
          .from('vets')
          .update({ status: 'offline' })
          .eq('profile_id', userId);
        if (offlineError) throw offlineError;
      }

      setState({ status: 'ready', userId, role });
    },
    [state],
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <SessionContext.Provider value={{ ...state, setRole, retry }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>.');
  return value;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Error desconocido.';
}
