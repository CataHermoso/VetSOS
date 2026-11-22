import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { MessageScreen } from '@/components/StatusScreens';
import { config } from '@/config';
import { priceLines } from '@/features/emergency/prices';
import { VetCase, currentCase } from '@/features/vet/currentCase';
import { VET_REJECT_OPTIONS, VetRejectReason } from '@/features/vet/types';
import { setVetStatus, snoozeVet } from '@/features/vet/vetData';
import { formatARS, formatSeconds } from '@/lib/format';
import { formatKm } from '@/lib/geo';
import { describeArea } from '@/lib/location';
import { errorMessage, useSession } from '@/lib/session';
import { colors, font, radius, spacing } from '@/theme';

// Buzz, pause, buzz… until the vet answers or time runs out.
const ALERT_PATTERN = [0, 700, 500];

type Step = 'deciding' | 'reasons' | 'timeout';

// Incoming emergency: everything needed to decide in a few seconds, then Aceptar / Rechazar.
export default function IncomingOffer() {
  const [vetCase] = useState(currentCase.get);

  if (!vetCase || vetCase.acceptedAt) {
    return (
      <MessageScreen
        title="La urgencia ya no está disponible"
        message="Seguís de guardia. Te avisamos si llega otra."
        actionLabel="Volver"
        onAction={() => router.dismissTo('/vet')}
      />
    );
  }
  return <Offer vetCase={vetCase} />;
}

function Offer({ vetCase }: { vetCase: VetCase }) {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;
  const { offer, vet } = vetCase;

  const [step, setStep] = useState<Step>('deciding');
  const [secondsLeft, setSecondsLeft] = useState<number>(config.offerTimeoutSeconds);
  const [area, setArea] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deadline] = useState(() => Date.now() + config.offerTimeoutSeconds * 1000);

  // Alert + countdown while deciding. Leaving the screen always stops the buzzing.
  useEffect(() => {
    if (step === 'timeout') return;
    Vibration.vibrate(ALERT_PATTERN, true);
    const tick = setInterval(() => {
      const left = (deadline - Date.now()) / 1000;
      setSecondsLeft(Math.max(0, left));
      if (left <= 0) setStep('timeout');
    }, 250);
    return () => {
      clearInterval(tick);
      Vibration.cancel();
    };
  }, [step, deadline]);

  useEffect(() => {
    describeArea(offer.ownerCoords).then(setArea);
  }, [offer.ownerCoords]);

  async function accept() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      await setVetStatus(userId, 'busy');
      currentCase.accept();
      router.replace('/vet/case');
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  async function reject(reason: VetRejectReason) {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      if (reason === 'busy_30') await snoozeVet(userId, 30);
      if (reason === 'unavailable_today') await setVetStatus(userId, 'offline', { snoozedUntil: null });
      currentCase.clear();
      router.dismissTo('/vet');
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  if (step === 'timeout') {
    return (
      <MessageScreen
        title="No respondiste a tiempo"
        message="La urgencia pasó al siguiente veterinario. Seguís de guardia."
        actionLabel="Volver"
        onAction={() => {
          currentCase.clear();
          router.dismissTo('/vet');
        }}
      />
    );
  }

  const { total } = priceLines(vet.prices, offer.place);

  if (step === 'reasons') {
    return (
      <Screen footer={<SecondaryButton label="Volver" onPress={() => setStep('deciding')} disabled={saving} />}>
        <View style={styles.body}>
          <Text style={styles.title}>¿Por qué no podés?</Text>
          <Text style={styles.muted}>Se lo contamos al dueño y buscamos al siguiente veterinario.</Text>
          <Text style={styles.timerInline}>Quedan {formatSeconds(secondsLeft)}</Text>
          {VET_REJECT_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              disabled={saving}
              onPress={() => reject(o.value)}
              style={({ pressed }) => [styles.reason, pressed && styles.reasonPressed]}
            >
              <Text style={styles.reasonLabel}>{o.label}</Text>
              <Text style={styles.reasonEffect}>{o.effect}</Text>
            </Pressable>
          ))}
          {saving ? <ActivityIndicator color={colors.primary} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton label={saving ? 'Aceptando…' : 'ACEPTAR'} hint="Después lo llamás" onPress={accept} disabled={saving} />
          <SecondaryButton label="Rechazar" onPress={() => setStep('reasons')} disabled={saving} />
        </>
      }
    >
      <View style={styles.banner}>
        <Text style={styles.bannerKicker}>Urgencia entrante</Text>
        <Text style={styles.bannerTitle}>{offer.ownerFirstName} necesita ayuda</Text>
        <View style={styles.timer}>
          <Text style={styles.timerText}>Respondé en {formatSeconds(secondsLeft)}</Text>
        </View>
      </View>

      <Card>
        <Row label="Distancia" value={`A ${formatKm(offer.distanceKm)} de vos`} />
        {area ? <Row label="Zona" value={area} /> : null}
        <Row
          label="Dónde"
          value={offer.place === 'clinic' ? 'Lleva a su mascota a tu consultorio' : 'Vas vos: no tiene cómo trasladarla'}
        />
        <Row label="Cobrarías" value={`Desde ${formatARS(total)}`} />
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  banner: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerKicker: {
    color: colors.onPrimary,
    opacity: 0.85,
    fontSize: font.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bannerTitle: {
    color: colors.onPrimary,
    fontSize: font.title,
    fontWeight: '800',
    textAlign: 'center',
  },
  timer: {
    backgroundColor: colors.onPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  timerText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: font.body,
  },
  timerInline: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: font.small,
  },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
  },
  muted: {
    fontSize: font.body,
    color: colors.textMuted,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowValue: {
    fontSize: font.subtitle,
    fontWeight: '600',
    color: colors.text,
  },
  reason: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  reasonPressed: {
    backgroundColor: colors.surface,
  },
  reasonLabel: {
    fontSize: font.subtitle,
    fontWeight: '700',
    color: colors.text,
  },
  reasonEffect: {
    fontSize: font.small,
    color: colors.textMuted,
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
    textAlign: 'center',
  },
});
