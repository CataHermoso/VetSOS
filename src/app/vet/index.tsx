import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Form';
import { KeepScreenOn } from '@/components/KeepScreenOn';
import { Screen } from '@/components/Screen';
import { MessageScreen } from '@/components/StatusScreens';
import { getVetCase, offerFromRow } from '@/features/vet/api';
import { currentCase, snapshotOf } from '@/features/vet/currentCase';
import { PendingPayments } from '@/features/vet/PendingPayments';
import { useIncomingOffers } from '@/features/vet/useIncomingOffers';
import { mockOfferFor } from '@/features/vet/mockOffer';
import { VetState, clearSnooze, isVetProfileComplete, loadVet, setVetStatus } from '@/features/vet/vetData';
import { formatTime } from '@/lib/format';
import { getCurrentCoords } from '@/lib/location';
import { errorMessage, useSession } from '@/lib/session';
import { colors, font, radius, spacing } from '@/theme';

// Vet home: one big availability switch.
export default function VetHome() {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;

  const [vet, setVet] = useState<VetState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoadError(null);
    try {
      const loaded = await loadVet(userId);
      // Busy but this phone doesn't know the case (app was closed): bring it back from the server.
      if (loaded.status === 'busy' && !currentCase.get()?.acceptedAt) {
        const saved = await getVetCase();
        if (saved) {
          currentCase.restore({ offer: saved.offer, vet: snapshotOf(loaded.profile), details: saved.details, acceptedAt: saved.acceptedAt });
        }
      }
      setVet(loaded);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [userId]);

  // Reload every time the screen shows: the profile or status may have changed elsewhere.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // When the 30-minute pause ends, refresh so the screen stops saying "Pausado".
  const snoozeEnd = vet?.snoozedUntil?.getTime() ?? 0;
  useEffect(() => {
    const ms = snoozeEnd - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(() => load(), ms + 1000);
    return () => clearTimeout(t);
  }, [snoozeEnd, load]);

  // On call with a complete profile: listen for real emergencies.
  const onCall = vet !== null && vet.status === 'available' && isVetProfileComplete(vet.profile);
  useIncomingOffers(userId, onCall, (row) => {
    if (!vet) return;
    currentCase.offer(offerFromRow(row), snapshotOf(vet.profile));
    router.push('/vet/offer');
  });

  if (loadError) return <MessageScreen title="No pudimos cargar tus datos" message={loadError} actionLabel="Reintentar" onAction={load} />;
  if (!vet || !userId) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const complete = isVetProfileComplete(vet.profile);
  const activeCase = currentCase.get();
  const snoozed = vet.status === 'available' && vet.snoozedUntil && vet.snoozedUntil > new Date() ? vet.snoozedUntil : null;

  async function change(work: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await work();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function toggle() {
    if (!vet || !userId) return;
    if (vet.status === 'available') {
      return change(() => setVetStatus(userId, 'offline', { snoozedUntil: null }));
    }
    // Going on call: save where the vet is, so distances are right.
    return change(async () => {
      const gps = await getCurrentCoords();
      const coords = gps.ok ? gps.coords : vet.profile.clinicCoords;
      if (!coords) throw new Error('Necesitamos tu ubicación para mandarte urgencias cercanas. Permití el acceso a la ubicación.');
      await setVetStatus(userId, 'available', { coords, snoozedUntil: null });
    });
  }

  function simulateOffer() {
    if (!vet) return;
    const coords = vet.lastCoords ?? vet.profile.clinicCoords;
    if (!coords) return setError('Volvé a ponerte Disponible para que tomemos tu ubicación.');
    currentCase.offer(mockOfferFor(vet.profile, coords), snapshotOf(vet.profile));
    router.push('/vet/offer');
  }

  const footer = (
    <>
      <SecondaryButton label="Mi agenda" hint="Turnos y horarios" onPress={() => router.push('/vet/agenda')} />
      <SecondaryButton label="Mi perfil" hint="Precios, cómo atendés, cobro" onPress={() => router.push('/vet/profile')} />
      <SecondaryButton label="Cambiar de modo" onPress={() => router.push('/?pick=1')} />
    </>
  );

  // 1. Profile first: without prices and bank details we can't send emergencies.
  if (!complete) {
    return (
      <Screen footer={<SecondaryButton label="Cambiar de modo" onPress={() => router.push('/?pick=1')} />}>
        <View style={styles.center}>
          <Text style={styles.title}>Completá tu perfil</Text>
          <Text style={styles.help}>
            Antes de ponerte de guardia necesitamos saber cómo atendés, cuánto cobrás y dónde te transfieren.
          </Text>
          <PrimaryButton size="normal" label="Completar mi perfil" onPress={() => router.push('/vet/profile')} />
        </View>
      </Screen>
    );
  }

  // 2. Busy with an emergency.
  if (vet.status === 'busy') {
    return (
      <Screen footer={footer}>
        <View style={styles.center}>
          <View style={[styles.statusPill, styles.statusBusy]}>
            <Text style={styles.statusBusyText}>Ocupado</Text>
          </View>
          {activeCase?.acceptedAt ? (
            <>
              <Text style={styles.title}>Tenés una urgencia en curso</Text>
              <Text style={styles.help}>No te llegan otras urgencias hasta que la termines.</Text>
              <PrimaryButton size="normal" label="Ver urgencia" onPress={() => router.push('/vet/case')} />
            </>
          ) : (
            <>
              <Text style={styles.help}>Figurás como ocupado, pero no encontramos una urgencia abierta en este teléfono.</Text>
              <PrimaryButton
                size="normal"
                label={saving ? 'Guardando…' : 'Liberarme y volver a guardia'}
                disabled={saving}
                onPress={() => change(() => setVetStatus(userId, 'available'))}
              />
            </>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </Screen>
    );
  }

  // 3. The switch.
  const available = vet.status === 'available';
  return (
    <Screen footer={footer}>
      {available ? <KeepScreenOn tag="vet-on-call" /> : null}
      <View style={styles.center}>
        <Text style={styles.label}>Tu estado</Text>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: available, busy: saving }}
          disabled={saving}
          onPress={toggle}
          style={({ pressed }) => [styles.toggle, available ? styles.toggleOn : styles.toggleOff, (pressed || saving) && styles.pressed]}
        >
          {saving ? (
            <ActivityIndicator color={available ? colors.success : colors.textMuted} />
          ) : (
            <View style={[styles.dot, available ? styles.dotOn : styles.dotOff]} />
          )}
          <Text style={[styles.toggleText, available && styles.toggleTextOn]}>{available ? 'Disponible' : 'No disponible'}</Text>
        </Pressable>

        <Text style={styles.help}>
          {!available
            ? 'Tocá para ponerte de guardia. Podés pausarla cuando quieras.'
            : snoozed
              ? 'Seguís de guardia, en pausa.'
              : 'Estás de guardia. Te van a llegar urgencias cercanas compatibles con tu forma de atender.'}
        </Text>
        {available ? (
          <Text style={styles.note}>Dejá la app abierta: la pantalla queda encendida para que te lleguen las urgencias.</Text>
        ) : null}

        {snoozed ? (
          <Card>
            <Text style={styles.body}>⏸ Pausado hasta las {formatTime(snoozed)}. No te llegan urgencias hasta entonces.</Text>
            <SecondaryButton
              label="Recibir urgencias ya"
              onPress={() => change(() => clearSnooze(userId))}
            />
          </Card>
        ) : null}

        {__DEV__ && available && !snoozed ? (
          <Card>
            <Text style={styles.devLabel}>Simulación (solo en desarrollo)</Text>
            <SecondaryButton label="Simular urgencia entrante" onPress={simulateOffer} />
          </Card>
        ) : null}

        <PendingPayments userId={userId} />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  label: {
    fontSize: font.subtitle,
    color: colors.textMuted,
    textAlign: 'center',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderRadius: radius.xl,
    paddingVertical: spacing.xxl,
    borderWidth: 2,
  },
  toggleOn: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  toggleOff: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
  },
  dotOn: {
    backgroundColor: colors.success,
  },
  dotOff: {
    backgroundColor: colors.textMuted,
  },
  toggleText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textMuted,
  },
  toggleTextOn: {
    color: colors.success,
  },
  statusPill: {
    alignSelf: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  statusBusy: {
    backgroundColor: colors.primarySoft,
  },
  statusBusyText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: font.subtitle,
  },
  help: {
    fontSize: font.body,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'center',
  },
  note: {
    fontSize: font.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  body: {
    fontSize: font.body,
    lineHeight: 22,
    color: colors.text,
  },
  devLabel: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
    textAlign: 'center',
  },
});
