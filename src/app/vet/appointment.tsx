import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card, Field, TextField } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { LoadingScreen, MessageScreen } from '@/components/StatusScreens';
import {
  VetAppointment,
  appointmentErrorMessage,
  cancelAppointment,
  finishAppointment,
  getVetAppointments,
  setAppointmentPayment,
} from '@/features/appointments/api';
import { dayLabel } from '@/features/appointments/dates';
import { formatARS, formatTime } from '@/lib/format';
import { callPhone, openInMaps } from '@/lib/maps';
import { colors, font, spacing } from '@/theme';

type Step = 'view' | 'confirmCancel' | 'amount' | 'payment';

// One appointment from the vet's agenda: call, directions, cancel, or close it and get paid.
export default function VetAppointmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [appt, setAppt] = useState<VetAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('view');
  const [amountText, setAmountText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVetAppointments()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((a) => a.id === id) ?? null;
        setAppt(found);
        if (found?.status === 'finished') setStep('payment');
      })
      .catch((e) => {
        if (!cancelled) setError(appointmentErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function run(work: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(appointmentErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (!appt) {
    return <MessageScreen title="No encontramos el turno" message={error ?? 'Puede que ya no esté en tu agenda.'} actionLabel="Volver" onAction={() => (router.canGoBack() ? router.back() : router.replace('/vet/agenda'))} />;
  }

  const when = `${dayLabel(appt.startsAt)} · ${formatTime(appt.startsAt)}`;
  const errorText = error ? <Text style={styles.error}>{error}</Text> : null;

  if (step === 'confirmCancel') {
    return (
      <Screen
        footer={
          <>
            {errorText}
            <PrimaryButton
              size="normal"
              label={saving ? 'Cancelando…' : 'Sí, cancelar el turno'}
              disabled={saving}
              onPress={() => run(async () => {
                await cancelAppointment(appt.id);
                if (router.canGoBack()) router.back();
                else router.replace('/vet/agenda');
              })}
            />
            <SecondaryButton label="No, volver" onPress={() => setStep('view')} />
          </>
        }
      >
        <View style={styles.center}>
          <Text style={styles.title}>¿Cancelar el turno?</Text>
          <Text style={styles.muted}>
            {when} con {appt.name}. Avisale por teléfono: el horario vuelve a quedar libre.
          </Text>
        </View>
      </Screen>
    );
  }

  if (step === 'amount') {
    return (
      <Screen
        footer={
          <>
            {errorText}
            <PrimaryButton
              size="normal"
              label={saving ? 'Guardando…' : appt.createdBy === 'owner' ? 'Enviar monto al dueño' : 'Guardar monto'}
              disabled={saving}
              onPress={() => {
                const value = Number(amountText.replace(/\D/g, ''));
                if (!value) return setError('Escribí cuánto cobraste.');
                run(async () => {
                  await finishAppointment(appt.id, value);
                  setAppt({ ...appt, status: 'finished', finalAmount: value, paymentStatus: 'pending' });
                  setStep('payment');
                });
              }}
            />
            <SecondaryButton label="Volver" onPress={() => setStep('view')} />
          </>
        }
      >
        <View style={styles.center}>
          <Text style={styles.title}>¿Cuánto cobraste?</Text>
          {appt.createdBy === 'owner' ? (
            <Text style={styles.muted}>{appt.name} va a ver este monto y tus datos para transferirte.</Text>
          ) : null}
          <Field label="Monto final">
            <TextField value={amountText} onChangeText={setAmountText} keyboardType="number-pad" placeholder="$ 0" />
          </Field>
        </View>
      </Screen>
    );
  }

  if (step === 'payment') {
    const paid = appt.paymentStatus === 'paid';
    return (
      <Screen
        footer={
          <>
            {errorText}
            {!paid ? (
              <PrimaryButton
                size="normal"
                label={saving ? 'Guardando…' : '✓ Pago realizado'}
                disabled={saving}
                onPress={() => run(async () => {
                  await setAppointmentPayment(appt.id, 'paid');
                  setAppt({ ...appt, paymentStatus: 'paid' });
                })}
              />
            ) : null}
            <SecondaryButton label={paid ? 'Volver a la agenda' : 'Todavía no llegó: volver'} onPress={() => (router.canGoBack() ? router.back() : router.replace('/vet/agenda'))} />
          </>
        }
      >
        <View style={styles.center}>
          <Text style={styles.done}>✓ Turno finalizado</Text>
          <Text style={styles.title}>{formatARS(appt.finalAmount ?? 0)}</Text>
          <Text style={styles.muted}>{paid ? 'Pago recibido.' : `Pago pendiente de ${appt.name}. Marcalo cuando te llegue.`}</Text>
        </View>
      </Screen>
    );
  }

  const booked = appt.status === 'booked';
  return (
    <Screen
      scroll
      footer={
        <>
          {errorText}
          {appt.phone ? <PrimaryButton size="normal" label={`📞 Llamar a ${appt.name}`} onPress={() => callPhone(appt.phone)} /> : null}
          {booked ? <SecondaryButton label="Finalizar turno" hint="Cargar el monto" onPress={() => setStep('amount')} /> : null}
          {booked ? <SecondaryButton label="Cancelar turno" onPress={() => setStep('confirmCancel')} /> : null}
        </>
      }
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>{when}</Text>
        <Text style={styles.title}>{appt.name}</Text>
        {appt.phone ? <Text style={styles.muted}>Tel. {appt.phone}</Text> : null}
        {appt.status === 'cancelled' ? (
          <Text style={styles.cancelled}>Cancelado{appt.cancelledBy === 'owner' ? ' por el dueño' : ''}</Text>
        ) : null}
      </View>

      <Card>
        <Text style={styles.cardLabel}>Dónde</Text>
        {appt.place === 'clinic' ? (
          <Text style={styles.cardValue}>En tu consultorio</Text>
        ) : (
          <>
            <Text style={styles.cardValue}>A domicilio</Text>
            {appt.reference ? <Text style={styles.body}>{appt.reference}</Text> : null}
            {appt.coords ? <SecondaryButton label="Abrir en Google Maps" onPress={() => openInMaps(appt.coords!)} /> : null}
            {!appt.coords && appt.createdBy === 'vet' ? <Text style={styles.muted}>Pedile la dirección por teléfono.</Text> : null}
          </>
        )}
      </Card>

      {appt.reason ? (
        <Card>
          <Text style={styles.cardLabel}>{appt.createdBy === 'owner' ? 'Motivo' : 'Nota'}</Text>
          <Text style={styles.body}>{appt.reason}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  header: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  kicker: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  cancelled: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.warning,
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
  error: {
    color: colors.warning,
    fontSize: font.small,
    textAlign: 'center',
  },
});
