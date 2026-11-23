import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card, Field, TextField } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { MessageScreen } from '@/components/StatusScreens';
import { apiErrorMessage } from '@/features/emergency/api';
import { priceLines } from '@/features/emergency/prices';
import { finishEmergency, setPaymentStatus } from '@/features/vet/api';
import { VetCase, currentCase } from '@/features/vet/currentCase';
import { setVetStatus } from '@/features/vet/vetData';
import { formatARS } from '@/lib/format';
import { getCurrentCoords } from '@/lib/location';
import { errorMessage, useSession } from '@/lib/session';
import { colors, font, spacing } from '@/theme';

type Step = 'amount' | 'payment' | 'next';

// Close the case in three short steps:
// final amount → payment (paid or pending) → back on call or end the shift.
// Care, payment and availability are separate states; here they read as one flow.
export default function FinishScreen() {
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
  return <Finish vetCase={vetCase} />;
}

function Finish({ vetCase }: { vetCase: VetCase }) {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;
  const { offer, vet } = vetCase;
  const reference = priceLines(vet.prices, offer.place, vetCase.acceptedAt).total;

  const [step, setStep] = useState<Step>('amount');
  const [amountText, setAmountText] = useState(String(reference));
  const [amount, setAmount] = useState(reference);
  const [paid, setPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emergencyId = offer.emergencyId; // null for a simulated case

  async function sendAmount() {
    const value = Number(amountText.replace(/\D/g, ''));
    if (!value) return setError('Escribí cuánto cobraste.');
    setError(null);
    setSaving(true);
    try {
      if (emergencyId) await finishEmergency(emergencyId, value);
      setAmount(value);
      currentCase.finish(value);
      setStep('payment');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function markPayment(isPaid: boolean) {
    setError(null);
    setSaving(true);
    try {
      if (emergencyId && isPaid) await setPaymentStatus(emergencyId, 'paid');
      currentCase.setPayment(isPaid ? 'paid' : 'pending');
      setPaid(isPaid);
      setStep('next');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function goOn(available: boolean) {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      if (available) {
        const gps = await getCurrentCoords(); // you probably moved: update where you are
        await setVetStatus(userId, 'available', { coords: gps.ok ? gps.coords : null, snoozedUntil: null });
      } else {
        await setVetStatus(userId, 'offline', { snoozedUntil: null });
      }
      currentCase.clear();
      router.dismissTo('/vet');
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  const errorText = error ? <Text style={styles.error}>{error}</Text> : null;

  if (step === 'amount') {
    return (
      <Screen
        footer={
          <>
            {errorText}
            <PrimaryButton size="normal" label={saving ? 'Enviando…' : 'Enviar monto al dueño'} onPress={sendAmount} disabled={saving} />
            <SecondaryButton label="Volver" onPress={() => router.back()} />
          </>
        }
      >
        <View style={styles.body}>
          <Text style={styles.title}>¿Cuánto cobraste?</Text>
          <Text style={styles.muted}>
            {offer.ownerFirstName} va a ver este monto y tus datos para transferirte.
          </Text>
          <Field label="Monto final" hint={`Precio de referencia: ${formatARS(reference)}. Sumá medicamentos o estudios si hubo.`}>
            <TextField value={amountText} onChangeText={setAmountText} keyboardType="number-pad" placeholder="$ 0" />
          </Field>
        </View>
      </Screen>
    );
  }

  if (step === 'payment') {
    return (
      <Screen
        footer={
          <>
            {errorText}
            <PrimaryButton size="normal" label="✓ Pago realizado" onPress={() => markPayment(true)} disabled={saving} />
            <SecondaryButton label="Todavía no llegó: cerrar con pago pendiente" onPress={() => markPayment(false)} disabled={saving} />
          </>
        }
      >
        <View style={styles.body}>
          <Text style={styles.title}>Esperando el pago</Text>
          <Text style={styles.muted}>
            {offer.ownerFirstName} ya ve esto. Marcalo como pagado cuando te llegue la transferencia.
          </Text>
          <Card>
            <Text style={styles.amount}>{formatARS(amount)}</Text>
            {vet.bank.alias ? <Line label="Alias" value={vet.bank.alias} /> : null}
            {vet.bank.cbuCvu ? <Line label="CBU / CVU" value={vet.bank.cbuCvu} /> : null}
            <Line label="Titular" value={vet.bank.holder} />
            {vet.bank.bankName ? <Line label="Banco" value={vet.bank.bankName} /> : null}
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          {errorText}
          <PrimaryButton size="normal" label={saving ? 'Guardando…' : 'Volver a guardia'} onPress={() => goOn(true)} disabled={saving} />
          <SecondaryButton label="Terminar mi guardia" onPress={() => goOn(false)} disabled={saving} />
        </>
      }
    >
      <View style={styles.body}>
        <Text style={styles.done}>✓ Atención finalizada</Text>
        <Text style={styles.muted}>
          {paid ? `Pago de ${formatARS(amount)} recibido.` : `Pago de ${formatARS(amount)} pendiente.`}
        </Text>
        <Text style={styles.title}>¿Querés volver a estar disponible?</Text>
      </View>
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

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
  },
  muted: {
    fontSize: font.body,
    lineHeight: 22,
    color: colors.textMuted,
  },
  done: {
    fontSize: font.subtitle,
    fontWeight: '800',
    color: colors.success,
  },
  amount: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  lineLabel: {
    fontSize: font.body,
    color: colors.textMuted,
  },
  lineValue: {
    flexShrink: 1,
    fontSize: font.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
    textAlign: 'center',
  },
});
