import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { EmergencyRow, apiErrorMessage, fetchOwnerActiveEmergency } from '@/features/emergency/api';
import { resumeOwnerEmergency } from '@/features/emergency/resume';
import { formatARS } from '@/lib/format';
import { useSession } from '@/lib/session';
import { colors, font, spacing } from '@/theme';

// Owner home: one huge emergency button, everything else is secondary.
// If an emergency still needs the owner (vet on the way, or payment pending), it shows on top.
export default function OwnerHome() {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;
  const [active, setActive] = useState<EmergencyRow | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      fetchOwnerActiveEmergency(userId)
        .then((row) => {
          if (!cancelled) setActive(row);
        })
        .catch(() => {}); // not critical: the emergency button works anyway
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  async function openActive() {
    if (!active) return;
    setOpening(true);
    setError(null);
    try {
      const route = await resumeOwnerEmergency(active);
      if (route) router.push(route);
      else setError('No pudimos abrir la urgencia. Probá de nuevo.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setOpening(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.logo}>VetSOS</Text>
        <Text style={styles.subtitle}>Ayuda veterinaria urgente, cerca tuyo.</Text>
      </View>

      {active ? (
        <Card>
          <Text style={styles.activeTitle}>
            {active.status === 'accepted'
              ? 'Tenés una urgencia en curso'
              : `Falta pagar ${formatARS(active.final_amount ?? 0)}`}
          </Text>
          <SecondaryButton
            label={opening ? 'Abriendo…' : active.status === 'accepted' ? 'Ver veterinario' : 'Ver datos para pagar'}
            onPress={openActive}
            disabled={opening}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Card>
      ) : null}

      <View style={styles.main}>
        <PrimaryButton
          label="EMERGENCIA VETERINARIA"
          hint="Tocá para buscar un veterinario de guardia"
          onPress={() => router.push('/owner/emergency')}
        />
      </View>

      <View style={styles.secondary}>
        <SecondaryButton label="Sacar turno" hint="Mis turnos" onPress={() => router.push('/owner/appointments')} />
        <SecondaryButton label="Perfil" hint="Tus datos" onPress={() => router.push('/owner/setup?from=profile')} />
        <SecondaryButton label="Cambiar de modo" onPress={() => router.push('/?pick=1')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: font.body,
    color: colors.textMuted,
  },
  activeTitle: {
    fontSize: font.subtitle,
    fontWeight: '700',
    color: colors.text,
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
  },
  main: {
    flex: 1,
    justifyContent: 'center',
  },
  secondary: {
    gap: spacing.sm,
  },
});
