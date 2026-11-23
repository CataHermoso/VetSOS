import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { LoadingScreen } from '@/components/StatusScreens';
import { VetAppointment, appointmentErrorMessage, getVetAppointments } from '@/features/appointments/api';
import { dayKey, dayLabel } from '@/features/appointments/dates';
import { formatARS, formatTime } from '@/lib/format';
import { colors, font, radius, spacing } from '@/theme';

// "Mi agenda": upcoming appointments by day, plus what still needs doing (payments).
export default function AgendaScreen() {
  const [items, setItems] = useState<VetAppointment[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getVetAppointments()
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
    }, []),
  );

  if (!items && !error) return <LoadingScreen />;

  const now = loadedAt; // when the list was loaded (no clock reads while drawing)
  // Still to do: upcoming (booked or cancelled, so cancellations get noticed) and past ones not closed yet.
  const visible = (items ?? []).filter(
    (a) =>
      (a.status === 'booked') ||
      (a.status === 'cancelled' && a.startsAt.getTime() > now) ||
      (a.status === 'finished' && a.paymentStatus === 'pending'),
  );
  const groups = new Map<string, VetAppointment[]>();
  for (const a of visible) {
    const key = dayKey(a.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  return (
    <Screen
      scroll
      footer={
        <>
          <PrimaryButton size="normal" label="Agregar turno" onPress={() => router.push('/vet/agenda-add')} />
          <SecondaryButton label="Mis horarios" hint="Días, horas y duración" onPress={() => router.push('/vet/schedule')} />
        </>
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No tenés turnos próximos</Text>
          <Text style={styles.muted}>
            Cargá tus horarios para que los dueños te reserven, o agregá un turno si alguien te llamó.
          </Text>
        </View>
      ) : (
        Array.from(groups.entries()).map(([key, list]) => (
          <View key={key} style={styles.day}>
            <Text style={styles.dayTitle}>{dayLabel(list[0].startsAt)}</Text>
            {list.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/vet/appointment', params: { id: a.id } })}
                style={({ pressed }) => [styles.item, a.status === 'cancelled' && styles.itemCancelled, pressed && styles.pressed]}
              >
                <Text style={styles.time}>{formatTime(a.startsAt)}</Text>
                <View style={styles.flex}>
                  <Text style={styles.name}>{a.name}</Text>
                  <Text style={styles.muted}>
                    {a.place === 'clinic' ? 'Consultorio' : 'A domicilio'}
                    {a.createdBy === 'vet' ? ' · por teléfono' : ''}
                  </Text>
                  {a.status === 'cancelled' ? (
                    <Text style={styles.cancelled}>Cancelado{a.cancelledBy === 'owner' ? ' por el dueño' : ''}</Text>
                  ) : null}
                  {a.status === 'finished' ? <Text style={styles.pending}>Pago pendiente · {formatARS(a.finalAmount ?? 0)}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  empty: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: font.subtitle,
    fontWeight: '700',
    color: colors.text,
  },
  day: {
    gap: spacing.sm,
  },
  dayTitle: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  itemCancelled: {
    opacity: 0.6,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  time: {
    fontSize: font.subtitle,
    fontWeight: '800',
    color: colors.primary,
    minWidth: 56,
  },
  name: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.text,
  },
  muted: {
    fontSize: font.small,
    color: colors.textMuted,
  },
  cancelled: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.warning,
  },
  pending: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.primary,
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
  },
});
