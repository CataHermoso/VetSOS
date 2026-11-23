import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, Vibration, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Form';
import { PriceCard } from '@/components/PriceCard';
import { Screen } from '@/components/Screen';
import { MessageScreen } from '@/components/StatusScreens';
import { apiErrorMessage } from '@/features/emergency/api';
import { priceLines } from '@/features/emergency/prices';
import { useEmergencyStatus } from '@/features/emergency/useEmergencyStatus';
import { releaseEmergency } from '@/features/vet/api';
import { currentCase } from '@/features/vet/currentCase';
import { setVetStatus } from '@/features/vet/vetData';
import { formatKm } from '@/lib/geo';
import { callPhone, openInMaps } from '@/lib/maps';
import { useSession } from '@/lib/session';
import { colors, font, radius, spacing } from '@/theme';

// Accepted emergency: call the owner, get there, then "Finalizar atención".
export default function VetCaseScreen() {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;
  const [vetCase] = useState(currentCase.get);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real emergencies: notice if the owner cancels ("Ya no necesito ayuda").
  const live = useEmergencyStatus(vetCase?.offer.emergencyId ?? undefined);
  const cancelledByOwner = live?.status === 'cancelled';
  useEffect(() => {
    if (cancelledByOwner) Vibration.vibrate(400);
  }, [cancelledByOwner]);

  function leave() {
    currentCase.clear();
    router.dismissTo('/vet');
  }

  /** "No puedo ir": the emergency goes back to the owner, who looks for another vet. */
  async function release() {
    if (!vetCase || !userId) return;
    setReleasing(true);
    setError(null);
    try {
      if (vetCase.offer.emergencyId) await releaseEmergency(vetCase.offer.emergencyId);
      else await setVetStatus(userId, 'offline', { snoozedUntil: null }); // simulated case
      leave();
    } catch (e) {
      setError(apiErrorMessage(e));
      setReleasing(false);
    }
  }

  if (cancelledByOwner && vetCase) {
    return (
      <MessageScreen
        title={`${vetCase.offer.ownerFirstName} canceló la urgencia`}
        message="Ya no necesita ayuda. Volviste a estar disponible."
        actionLabel="Volver al inicio"
        onAction={leave}
      />
    );
  }

  if (!vetCase?.acceptedAt || !vetCase.details) {
    return (
      <MessageScreen
        title="No hay una urgencia en curso"
        message="Volvé al inicio para ver tu estado."
        actionLabel="Volver al inicio"
        onAction={() => router.dismissTo('/vet')}
      />
    );
  }

  const { offer, vet, details } = vetCase;
  const { lines, total } = priceLines(vet.prices, offer.place, vetCase.acceptedAt);

  return (
    <Screen
      scroll
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton size="normal" label={`📞 Llamar a ${offer.ownerFirstName}`} onPress={() => callPhone(details.ownerPhone)} />
          <SecondaryButton label="Finalizar atención" hint="Cargar el monto final" onPress={() => router.push('/vet/finish')} />
          {confirmRelease ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>
                ¿No podés ir? Le avisamos a {offer.ownerFirstName} para que busque otro veterinario, y quedás como No disponible.
              </Text>
              <View style={styles.confirmRow}>
                <View style={styles.flex}>
                  <SecondaryButton label={releasing ? 'Avisando…' : 'Sí, no puedo'} onPress={release} disabled={releasing} />
                </View>
                <View style={styles.flex}>
                  <SecondaryButton label="Cancelar" onPress={() => setConfirmRelease(false)} />
                </View>
              </View>
            </View>
          ) : (
            <SecondaryButton label="No puedo ir" onPress={() => setConfirmRelease(true)} />
          )}
        </>
      }
    >
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Aceptaste · Estás como Ocupado</Text>
        </View>
        <Text style={styles.title}>{offer.ownerFirstName}</Text>
        <Text style={styles.muted}>Tel. {details.ownerPhone}</Text>
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
            {details.reference ? <Text style={styles.body}>{details.reference}</Text> : null}
            <SecondaryButton label="Abrir en Google Maps" onPress={() => openInMaps(details.ownerCoords)} />
          </>
        )}
      </Card>

      <PriceCard lines={lines} total={total} note="Es lo que ve el dueño. El monto final lo cargás al terminar." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  confirm: {
    gap: spacing.sm,
  },
  confirmText: {
    fontSize: font.small,
    color: colors.text,
    textAlign: 'center',
  },
  confirmRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
    textAlign: 'center',
  },
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
