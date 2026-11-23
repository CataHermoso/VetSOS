import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { MessageScreen } from '@/components/StatusScreens';
import { getAppointmentPayment } from '@/features/appointments/api';
import { PaymentDetails, apiErrorMessage, getPaymentDetails } from '@/features/emergency/api';
import { currentEmergency } from '@/features/emergency/currentEmergency';
import { useEmergencyStatus } from '@/features/emergency/useEmergencyStatus';
import { formatARS } from '@/lib/format';
import { colors, font, radius, spacing } from '@/theme';

// How often an appointment's payment is re-checked (emergencies update live instead).
const APPOINTMENT_POLL_MS = 5000;

// The vet finished: what to pay and where to transfer. One main action: copy the alias.
// Works for an emergency (the one in progress) or an appointment (?appointment=<id>).
export default function PaymentScreen() {
  const { appointment } = useLocalSearchParams<{ appointment?: string }>();
  const [emergency] = useState(currentEmergency.get);
  const emergencyId = emergency?.emergencyId;

  if (appointment) return <Payment appointmentId={appointment} />;
  if (!emergencyId) {
    return (
      <MessageScreen
        title="No encontramos el pago"
        message="Volvé al inicio: si tenés algo pendiente, aparece ahí."
        actionLabel="Volver al inicio"
        onAction={() => router.dismissTo('/owner')}
      />
    );
  }
  return <Payment emergencyId={emergencyId} />;
}

function Payment({ emergencyId, appointmentId }: { emergencyId?: string; appointmentId?: string }) {
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const live = useEmergencyStatus(emergencyId);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!appointmentId) return;
    const t = setInterval(() => setTick((n) => n + 1), APPOINTMENT_POLL_MS);
    return () => clearInterval(t);
  }, [appointmentId]);

  // Load once, and again whenever the vet changes something (e.g. marks it paid).
  const liveKey = live ? `${live.status}/${live.payment_status}/${live.final_amount}` : String(tick);
  useEffect(() => {
    let cancelled = false;
    (appointmentId ? getAppointmentPayment(appointmentId) : getPaymentDetails(emergencyId!))
      .then((d) => {
        if (cancelled) return;
        if (d) setDetails(d);
        else setError('Todavía no está el monto final. Volvé a intentar en un rato.');
      })
      .catch((e) => {
        if (!cancelled) setError(apiErrorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [emergencyId, appointmentId, liveKey]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  function leave() {
    if (appointmentId) return router.back();
    currentEmergency.clear();
    router.dismissTo('/owner');
  }

  async function copy(label: string, value: string) {
    const ok = await Clipboard.setStringAsync(value);
    setCopied(ok ? `${label} copiado` : 'No se pudo copiar. Mantené apretado el texto para copiarlo.');
  }

  if (error && !details) {
    return <MessageScreen title="No pudimos cargar el pago" message={error} actionLabel="Volver al inicio" onAction={leave} />;
  }
  if (!details) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const paid = details.paymentStatus === 'paid';
  const { bank } = details;
  // Main button copies the alias; if there's no alias, the CBU/CVU.
  const main = bank.alias ? { label: 'Alias', value: bank.alias } : bank.cbuCvu ? { label: 'CBU/CVU', value: bank.cbuCvu } : null;

  return (
    <Screen
      scroll
      footer={
        <>
          {copied ? <Text style={styles.copied}>{copied}</Text> : null}
          {!paid && main ? (
            <PrimaryButton size="normal" label={`Copiar ${main.label.toLowerCase()}`} onPress={() => copy(main.label, main.value)} />
          ) : null}
          <SecondaryButton label={appointmentId ? "Volver" : "Volver al inicio"} onPress={leave} />
        </>
      }
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>Atención finalizada</Text>
        <Text style={styles.muted}>{paid ? `Le pagaste a ${details.vetName}` : `Total a pagar a ${details.vetName}`}</Text>
        <Text style={styles.amount}>{formatARS(details.finalAmount)}</Text>
        <View style={[styles.pill, paid ? styles.pillPaid : styles.pillPending]}>
          <Text style={[styles.pillText, paid ? styles.pillTextPaid : styles.pillTextPending]}>
            {paid ? '✓ Pago confirmado' : 'Pago pendiente'}
          </Text>
        </View>
      </View>

      {paid ? (
        <Card>
          <Text style={styles.body}>{details.vetName} confirmó que recibió la transferencia. ¡Gracias!</Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text style={styles.cardLabel}>Transferí a</Text>
            {bank.alias ? <CopyLine label="Alias" value={bank.alias} onCopy={copy} /> : null}
            {bank.cbuCvu ? <CopyLine label="CBU / CVU" value={bank.cbuCvu} onCopy={copy} /> : null}
            <Line label="Titular" value={bank.holder} />
            {bank.bankName ? <Line label="Banco" value={bank.bankName} /> : null}
          </Card>
          <Text style={styles.small}>
            Cuando le llegue la transferencia, {details.vetName} lo confirma y te aparece acá. Si tenés dudas sobre el monto, hablalo con
            {' '}
            {details.vetName}.
          </Text>
        </>
      )}
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function CopyLine({ label, value, onCopy }: { label: string; value: string; onCopy: (label: string, value: string) => void }) {
  return (
    <View style={styles.copyLine}>
      <Line label={label} value={value} />
      <Text accessibilityRole="button" style={styles.copyLink} onPress={() => onCopy(label, value)}>
        Copiar
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  kicker: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  muted: {
    fontSize: font.body,
    color: colors.textMuted,
  },
  amount: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.text,
  },
  pill: {
    marginTop: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillPending: {
    backgroundColor: colors.primarySoft,
  },
  pillPaid: {
    backgroundColor: colors.successSoft,
  },
  pillText: {
    fontSize: font.small,
    fontWeight: '700',
  },
  pillTextPending: {
    color: colors.primary,
  },
  pillTextPaid: {
    color: colors.success,
  },
  cardLabel: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  body: {
    fontSize: font.body,
    lineHeight: 22,
    color: colors.text,
  },
  small: {
    fontSize: font.small,
    lineHeight: 20,
    color: colors.textMuted,
  },
  line: {
    flex: 1,
    gap: 2,
  },
  lineLabel: {
    fontSize: font.small,
    color: colors.textMuted,
  },
  lineValue: {
    fontSize: font.subtitle,
    fontWeight: '700',
    color: colors.text,
  },
  copyLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copyLink: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  copied: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.success,
    textAlign: 'center',
  },
});
