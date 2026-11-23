import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/Buttons';
import { Card } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { LoadingScreen } from '@/components/StatusScreens';
import { OwnerAppointment, appointmentErrorMessage, cancelAppointment, getOwnerAppointments } from '@/features/appointments/api';
import { dayLabel } from '@/features/appointments/dates';
import { formatARS, formatTime } from '@/lib/format';
import { callPhone, openInMaps } from '@/lib/maps';
import { colors, font, spacing } from '@/theme';

// "Mis turnos": upcoming appointments, and payments still pending. Main action: book a new one.
export default function OwnerAppointments() {
  const [items, setItems] = useState<OwnerAppointment[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getOwnerAppointments()
        .then((list) => {
          if (cancelled) return;
          setItems(list);
          setLoadedAt(Date.now());
        })
        .catch((e) => {
          if (!cancelled) setError(appointmentErrorMessage(e));
        });
      return () => {
        cancelled = true;
      };
    }, [reloadKey]), // eslint-disable-line react-hooks/exhaustive-deps -- reloadKey only forces a refresh
  );

  async function cancel(id: string) {
    setError(null);
    try {
      await cancelAppointment(id);
      setConfirming(null);
      setReloadKey((n) => n + 1);
    } catch (e) {
      setError(appointmentErrorMessage(e));
    }
  }

  if (!items && !error) return <LoadingScreen />;

  const now = loadedAt; // when the list was loaded (no clock reads while drawing)
  const toPay = (items ?? []).filter((a) => a.status === 'finished' && a.paymentStatus === 'pending');
  const upcoming = (items ?? []).filter(
    (a) => (a.status === 'booked' || (a.status === 'cancelled' && a.cancelledBy === 'vet')) && a.startsAt.getTime() > now - 2 * 60 * 60 * 1000,
  );

  return (
    <Screen scroll footer={<PrimaryButton size="normal" label="Sacar turno" onPress={() => router.push('/owner/book')} />}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {toPay.map((a) => (
        <Card key={a.id}>
          <Text style={styles.cardLabel}>Falta pagar</Text>
          <Text style={styles.title}>
            {formatARS(a.finalAmount ?? 0)} a {a.vetName}
          </Text>
          <Text
            accessibilityRole="button"
            style={styles.link}
            onPress={() => router.push({ pathname: '/owner/payment', params: { appointment: a.id } })}
          >
            Ver datos para pagar
          </Text>
        </Card>
      ))}

      {upcoming.length === 0 && toPay.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.title}>No tenés turnos</Text>
          <Text style={styles.muted}>Reservá una consulta con un veterinario cerca tuyo, en su consultorio o en tu casa.</Text>
        </View>
      ) : null}

      {upcoming.map((a) => {
        const cancelled = a.status === 'cancelled';
        return (
          <Card key={a.id}>
            <Text style={styles.cardLabel}>
              {dayLabel(a.startsAt)} · {formatTime(a.startsAt)}
            </Text>
            <Text style={[styles.title, cancelled && styles.struck]}>{a.vetName}</Text>
            <Text style={styles.muted}>
              {a.place === 'clinic' ? (a.clinic?.address ?? 'En su consultorio') : 'En tu casa'} ·{' '}
              {formatARS(a.price + (a.place === 'home' ? a.homeExtra : 0))}
            </Text>
            {cancelled ? <Text style={styles.cancelled}>El veterinario canceló este turno. Podés sacar otro.</Text> : null}

            {!cancelled && confirming === a.id ? (
              <View style={styles.links}>
                <Text style={styles.question}>¿Cancelar el turno?</Text>
                <Text accessibilityRole="button" style={styles.danger} onPress={() => cancel(a.id)}>
                  Sí, cancelar
                </Text>
                <Text accessibilityRole="button" style={styles.link} onPress={() => setConfirming(null)}>
                  No
                </Text>
              </View>
            ) : null}

            {!cancelled && confirming !== a.id ? (
              <View style={styles.links}>
                {a.vetPhone ? (
                  <Text accessibilityRole="button" style={styles.link} onPress={() => callPhone(a.vetPhone)}>
                    Llamar
                  </Text>
                ) : null}
                {a.place === 'clinic' && a.clinic ? (
                  <Text accessibilityRole="button" style={styles.link} onPress={() => openInMaps(a.clinic!.coords)}>
                    Cómo llegar
                  </Text>
                ) : null}
                <Text accessibilityRole="button" style={styles.danger} onPress={() => setConfirming(a.id)}>
                  Cancelar
                </Text>
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: font.subtitle,
    fontWeight: '700',
    color: colors.text,
  },
  struck: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  muted: {
    fontSize: font.body,
    lineHeight: 22,
    color: colors.textMuted,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  question: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.text,
  },
  link: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.primary,
    paddingVertical: spacing.xs,
  },
  danger: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.warning,
    paddingVertical: spacing.xs,
  },
  cancelled: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.warning,
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
  },
});
