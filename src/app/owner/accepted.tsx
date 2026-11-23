import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, Vibration, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Form';
import { PriceCard } from '@/components/PriceCard';
import { Screen } from '@/components/Screen';
import { MessageScreen } from '@/components/StatusScreens';
import { currentEmergency } from '@/features/emergency/currentEmergency';
import { priceLines } from '@/features/emergency/prices';
import { useEmergencyStatus } from '@/features/emergency/useEmergencyStatus';
import { formatKm } from '@/lib/geo';
import { callPhone, openInMaps } from '@/lib/maps';
import { colors, font, radius, spacing } from '@/theme';

// A vet accepted: who, where to meet, what it costs, and one main "Llamar".
export default function AcceptedScreen() {
  const [emergency] = useState(currentEmergency.get);
  const accepted = emergency?.accepted;

  // Real emergencies: when the vet finishes the case, show what to pay.
  const live = useEmergencyStatus(emergency?.emergencyId);
  const finished = live?.status === 'finished';
  useEffect(() => {
    if (!finished) return;
    Vibration.vibrate(400);
    router.replace('/owner/payment');
  }, [finished]);

  if (!emergency || !accepted) {
    return (
      <MessageScreen
        title="No encontramos al veterinario"
        message="Volvé a intentar desde el inicio."
        actionLabel="Volver al inicio"
        onAction={() => router.dismissTo('/owner')}
      />
    );
  }

  const { vet, distanceKm: km, place } = accepted;
  const { lines, total } = priceLines(vet.prices, place);

  return (
    <Screen
      scroll
      footer={
        <>
          <PrimaryButton size="normal" label={`📞 Llamar a ${vet.name}`} onPress={() => callPhone(vet.phone)} />
          <SecondaryButton
            label="Volver al inicio"
            onPress={() => {
              currentEmergency.clear();
              router.dismissTo('/owner');
            }}
          />
        </>
      }
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✓ Aceptó tu urgencia</Text>
        </View>
        <Text style={styles.title}>{vet.name}</Text>
        <Text style={styles.muted}>A {formatKm(km)} de vos · Tel. {vet.phone}</Text>
        {emergency.emergencyId ? (
          <Text style={styles.small}>Cuando termine la atención, acá te aparece el monto final y cómo pagarle.</Text>
        ) : null}
      </View>

      <Card>
        <Text style={styles.cardLabel}>Dónde</Text>
        {place === 'clinic' && vet.clinic ? (
          <>
            <Text style={styles.cardValue}>Llevá a tu mascota a su consultorio</Text>
            <Text style={styles.body}>{vet.clinic.address}</Text>
            <SecondaryButton label="Abrir en Google Maps" onPress={() => openInMaps(vet.clinic!.coords)} />
          </>
        ) : (
          <>
            <Text style={styles.cardValue}>Va a ir a tu ubicación</Text>
            <Text style={styles.body}>Esperalo donde estás. Si cambiaste de lugar, avisale cuando te llame.</Text>
          </>
        )}
      </Card>

      <PriceCard lines={lines} total={total} note="El total puede variar según el diagnóstico, medicamentos o estudios." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.success,
    fontWeight: '700',
    fontSize: font.small,
  },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  muted: {
    fontSize: font.body,
    color: colors.textMuted,
  },
  small: {
    fontSize: font.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  cardLabel: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: font.subtitle,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: font.body,
    lineHeight: 22,
    color: colors.text,
  },
});
