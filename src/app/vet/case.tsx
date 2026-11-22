import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Form';
import { PriceCard } from '@/components/PriceCard';
import { Screen } from '@/components/Screen';
import { MessageScreen } from '@/components/StatusScreens';
import { priceLines } from '@/features/emergency/prices';
import { currentCase } from '@/features/vet/currentCase';
import { formatKm } from '@/lib/geo';
import { callPhone, openInMaps } from '@/lib/maps';
import { colors, font, radius, spacing } from '@/theme';

// Accepted emergency: call the owner, get there, then "Finalizar atención".
export default function VetCaseScreen() {
  const [vetCase] = useState(currentCase.get);

  if (!vetCase?.acceptedAt) {
    return (
      <MessageScreen
        title="No hay una urgencia en curso"
        message="Volvé al inicio para ver tu estado."
        actionLabel="Volver al inicio"
        onAction={() => router.dismissTo('/vet')}
      />
    );
  }

  const { offer, vet } = vetCase;
  const { lines, total } = priceLines(vet.prices, offer.place, vetCase.acceptedAt);

  return (
    <Screen
      scroll
      footer={
        <>
          <PrimaryButton size="normal" label={`📞 Llamar a ${offer.ownerFirstName}`} onPress={() => callPhone(offer.ownerPhone)} />
          <SecondaryButton label="Finalizar atención" hint="Cargar el monto final" onPress={() => router.push('/vet/finish')} />
        </>
      }
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Aceptaste · Estás como Ocupado</Text>
        </View>
        <Text style={styles.title}>{offer.ownerFirstName}</Text>
        <Text style={styles.muted}>Tel. {offer.ownerPhone}</Text>
        <Text style={styles.small}>Llamalo para saber qué le pasa a la mascota y coordinar.</Text>
      </View>

      <Card>
        <Text style={styles.cardLabel}>Dónde</Text>
        {offer.place === 'clinic' ? (
          <>
            <Text style={styles.cardValue}>Va a llevar a su mascota a tu consultorio</Text>
            <Text style={styles.body}>{vet.clinicAddress}</Text>
            <Text style={styles.cardNote}>Está a {formatKm(offer.distanceKm)}.</Text>
          </>
        ) : (
          <>
            <Text style={styles.cardValue}>Andá a su ubicación · {formatKm(offer.distanceKm)}</Text>
            {offer.reference ? <Text style={styles.body}>{offer.reference}</Text> : null}
            <SecondaryButton label="Abrir en Mapas" onPress={() => openInMaps(offer.ownerCoords)} />
          </>
        )}
      </Card>

      <PriceCard lines={lines} total={total} note="Es lo que ve el dueño. El monto final lo cargás al terminar." />
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
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.primary,
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
  cardNote: {
    fontSize: font.small,
    color: colors.textMuted,
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
