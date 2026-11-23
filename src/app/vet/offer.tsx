import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { MessageScreen } from '@/components/StatusScreens';
import { apiErrorMessage, fetchOffer } from '@/features/emergency/api';
import { priceLines } from '@/features/emergency/prices';
import { RespondResult, getVetCase, respondOffer } from '@/features/vet/api';
import { VetCase, currentCase } from '@/features/vet/currentCase';
import { VET_REJECT_OPTIONS, VetRejectReason } from '@/features/vet/types';
import { setVetStatus, snoozeVet } from '@/features/vet/vetData';
import { formatARS, formatSeconds } from '@/lib/format';
import { formatKm } from '@/lib/geo';
import { useSession } from '@/lib/session';
import { colors, font, radius, spacing } from '@/theme';

// Buzz, pause, buzz… until the vet answers or time runs out.
const ALERT_PATTERN = [0, 700, 500];
// How often we check whether the owner cancelled while the vet is deciding.
const CANCEL_CHECK_MS = 3000;

type Step = 'deciding' | 'reasons' | 'timeout' | 'gone' | 'busy';

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
  const live = offer.emergencyId !== null;

  const [step, setStep] = useState<Step>('deciding');
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, (offer.deadline - Date.now()) / 1000));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deciding = step === 'deciding' || step === 'reasons';

  // Alert + countdown while deciding. Leaving the screen always stops the buzzing.
  useEffect(() => {
    if (!deciding) return;
    Vibration.vibrate(ALERT_PATTERN, true);
    const tick = setInterval(() => {
      const left = (offer.deadline - Date.now()) / 1000;
      setSecondsLeft(Math.max(0, left));
      if (left <= 0) setStep('timeout');
    }, 250);
    return () => {
      clearInterval(tick);
      Vibration.cancel();
    };
  }, [deciding, offer.deadline]);

  // Real offers: notice if the owner cancels while the vet is deciding.
  useEffect(() => {
    if (!live || !deciding) return;
    const check = setInterval(() => {
      fetchOffer(offer.id)
        .then((row) => {
          if (row && row.response !== null && row.response !== 'accepted') setStep(row.response === 'timeout' ? 'timeout' : 'gone');
        })
        .catch(() => {});
    }, CANCEL_CHECK_MS);
    return () => clearInterval(check);
  }, [live, deciding, offer.id]);

  /** Shared handling of the server's answer to Aceptar / Rechazar. */
  function handleResult(result: RespondResult) {
    if (result === 'expired') setStep('timeout');
    else if (result === 'gone') setStep('gone');
    else if (result === 'busy') setStep('busy');
  }

  async function accept() {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      if (live) {
        const result = await respondOffer(offer.id, true);
        if (result !== 'accepted') {
          setSaving(false);
          return handleResult(result);
        }
        const saved = await getVetCase();
        if (!saved) throw new Error('Aceptaste, pero no pudimos cargar los datos. Volvé al inicio.');
        currentCase.accept(saved.details, saved.acceptedAt);
      } else {
        await setVetStatus(userId, 'busy');
        currentCase.accept(offer.mockDetails!);
      }
      router.replace('/vet/case');
    } catch (e) {
      setError(apiErrorMessage(e));
      setSaving(false);
    }
  }

  async function reject(reason: VetRejectReason) {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      if (live) {
        // The server records the reason and applies the pause / "no disponible".
        const result = await respondOffer(offer.id, false, reason);
        if (result !== 'rejected') {
          setSaving(false);
          return handleResult(result);
        }
      } else {
        if (reason === 'busy_30') await snoozeVet(userId, 30);
        if (reason === 'unavailable_today') await setVetStatus(userId, 'offline', { snoozedUntil: null });
      }
      currentCase.clear();
      router.dismissTo('/vet');
    } catch (e) {
      setError(apiErrorMessage(e));
      setSaving(false);
    }
  }

  function leave() {
    currentCase.clear();
    router.dismissTo('/vet');
  }

  if (step === 'timeout') {
    return (
      <MessageScreen
        title="No respondiste a tiempo"
        message="La urgencia pasó al siguiente veterinario. Seguís de guardia."
        actionLabel="Volver"
        onAction={leave}
      />
    );
  }
  if (step === 'gone') {
    return (
      <MessageScreen
        title="La urgencia ya no está disponible"
        message="El dueño canceló la búsqueda. Seguís de guardia."
        actionLabel="Volver"
        onAction={leave}
      />
    );
  }
  if (step === 'busy') {
    return (
      <MessageScreen
        title="Ya tenés una urgencia en curso"
        message="Terminala antes de aceptar otra."
        actionLabel="Volver"
        onAction={leave}
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
        {offer.area ? <Row label="Zona" value={offer.area} /> : null}
        <Row label="Dónde" value={offer.place === 'clinic' ? 'Lleva a su mascota a tu consultorio' : 'Vas vos a su ubicación'} />
        {offer.place === 'home' ? (
          <Row label="Transporte" value={offer.hasTransport ? 'Tiene cómo trasladar a su mascota' : 'No tiene cómo trasladarla'} />
        ) : null}
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
