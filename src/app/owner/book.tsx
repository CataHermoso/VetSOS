import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card, Choice, Field, TextField } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { LoadingScreen, MessageScreen } from '@/components/StatusScreens';
import {
  AppointmentVet,
  Slot,
  appointmentErrorMessage,
  bookAppointment,
  findAppointmentVets,
  getFreeSlots,
} from '@/features/appointments/api';
import { dayLabel } from '@/features/appointments/dates';
import { SlotPicker } from '@/features/appointments/SlotPicker';
import { Place } from '@/features/emergency/types';
import { loadOwnerData } from '@/features/owner/ownerData';
import { formatARS, formatTime } from '@/lib/format';
import { Coords, formatKm } from '@/lib/geo';
import { useSession } from '@/lib/session';
import { colors, font, radius, spacing } from '@/theme';

type Step = 'place' | 'vet' | 'time' | 'confirm' | 'done';

const priceFor = (vet: AppointmentVet, place: Place) => vet.price + (place === 'home' ? vet.homeExtra : 0);

// "Sacar turno": where → which vet → day and time → confirm. Booked right away.
export default function BookAppointment() {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;

  const [home, setHome] = useState<Coords | null | undefined>(undefined); // undefined = loading
  const [step, setStep] = useState<Step>('place');
  const [place, setPlace] = useState<Place>('clinic');
  const [vets, setVets] = useState<AppointmentVet[] | null>(null);
  const [vet, setVet] = useState<AppointmentVet | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The owner's saved location is where we look for vets (and where home visits go).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadOwnerData(userId)
      .then((d) => {
        if (cancelled) return;
        setHome(d.coords);
        if (d.hasTransport === false) setPlace('home');
      })
      .catch(() => {
        if (!cancelled) setHome(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function showVets() {
    if (!home) return;
    setError(null);
    setVets(null);
    setStep('vet');
    try {
      setVets(await findAppointmentVets(place, home.lat, home.lng));
    } catch (e) {
      setError(appointmentErrorMessage(e));
      setVets([]);
    }
  }

  async function chooseVet(v: AppointmentVet) {
    setVet(v);
    setSlot(null);
    setSlots(null);
    setError(null);
    setStep('time');
    try {
      setSlots(await getFreeSlots(v.vetId, place));
    } catch (e) {
      setError(appointmentErrorMessage(e));
      setSlots([]);
    }
  }

  async function confirm() {
    if (!vet || !slot) return;
    setSaving(true);
    setError(null);
    try {
      await bookAppointment(vet.vetId, place, slot.startsAt, reason);
      setStep('done');
    } catch (e) {
      // Someone took it first: show the times again, refreshed (then say why).
      if (String((e as { message?: string })?.message).includes('slot_taken')) await chooseVet(vet);
      setError(appointmentErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (home === undefined) return <LoadingScreen />;
  if (home === null) {
    return (
      <MessageScreen
        title="Primero cargá tus datos"
        message="Necesitamos tu ubicación para mostrarte veterinarios cerca."
        actionLabel="Cargar mis datos"
        onAction={() => router.replace('/owner/setup?from=profile')}
      />
    );
  }

  const errorText = error ? <Text style={styles.error}>{error}</Text> : null;

  if (step === 'done' && vet && slot) {
    const start = new Date(slot.startsAt);
    return (
      <MessageScreen
        title="✓ Turno reservado"
        message={`${dayLabel(start)} a las ${formatTime(start)} con ${vet.name}, ${place === 'clinic' ? 'en su consultorio' : 'en tu casa'}. Si no podés ir, cancelalo desde "Mis turnos".`}
        actionLabel="Ver mis turnos"
        onAction={() => (router.canGoBack() ? router.back() : router.replace('/owner/appointments'))}
      />
    );
  }

  if (step === 'place') {
    return (
      <Screen footer={<PrimaryButton size="normal" label="Buscar veterinarios" onPress={showVets} />}>
        <View style={styles.center}>
          <Text style={styles.title}>¿Dónde querés la consulta?</Text>
          <Choice
            options={[
              { value: 'clinic', label: 'En el consultorio' },
              { value: 'home', label: 'En mi casa' },
            ]}
            value={place}
            onChange={setPlace}
          />
          <Text style={styles.muted}>
            {place === 'clinic' ? 'Vas vos con tu mascota al consultorio.' : 'El veterinario va a tu casa (puede tener un costo extra).'}
          </Text>
        </View>
      </Screen>
    );
  }

  if (step === 'vet') {
    return (
      <Screen scroll footer={<SecondaryButton label="Volver" onPress={() => setStep('place')} />}>
        <Text style={styles.title}>Elegí un veterinario</Text>
        {errorText}
        {vets === null ? (
          <ActivityIndicator color={colors.primary} />
        ) : vets.length === 0 ? (
          <Text style={styles.muted}>
            {place === 'clinic'
              ? 'Por ahora no hay veterinarios con turnos en consultorio a menos de 30 km de tu ubicación guardada. Probá con "En mi casa".'
              : 'Por ahora no hay veterinarios con turnos a domicilio que lleguen a tu ubicación guardada. Probá con "En el consultorio".'}
          </Text>
        ) : (
          vets.map((v) => (
            <Pressable
              key={v.vetId}
              accessibilityRole="button"
              onPress={() => chooseVet(v)}
              style={({ pressed }) => [styles.vet, pressed && styles.pressed]}
            >
              <View style={styles.flex}>
                <Text style={styles.vetName}>{v.name}</Text>
                <Text style={styles.small}>
                  A {formatKm(v.distanceKm)}
                  {place === 'clinic' && v.clinicAddress ? ` · ${v.clinicAddress}` : ''}
                </Text>
              </View>
              <Text style={styles.price}>{formatARS(priceFor(v, place))}</Text>
            </Pressable>
          ))
        )}
      </Screen>
    );
  }

  if (step === 'time' && vet) {
    return (
      <Screen
        scroll
        footer={
          <>
            <PrimaryButton size="normal" label="Continuar" onPress={() => setStep('confirm')} disabled={!slot} />
            <SecondaryButton label="Volver" onPress={() => setStep('vet')} />
          </>
        }
      >
        <Text style={styles.title}>¿Cuándo?</Text>
        <Text style={styles.muted}>Turnos de {vet.slotMinutes} minutos con {vet.name}.</Text>
        {errorText}
        {slots === null ? <ActivityIndicator color={colors.primary} /> : <SlotPicker slots={slots} selected={slot} onSelect={setSlot} />}
      </Screen>
    );
  }

  if (step === 'confirm' && vet && slot) {
    const start = new Date(slot.startsAt);
    return (
      <Screen
        scroll
        footer={
          <>
            {errorText}
            <PrimaryButton size="normal" label={saving ? 'Reservando…' : 'Confirmar turno'} onPress={confirm} disabled={saving} />
            <SecondaryButton label="Volver" onPress={() => setStep('time')} />
          </>
        }
      >
        <Text style={styles.title}>Confirmá tu turno</Text>
        <Card>
          <Line label="Cuándo" value={`${dayLabel(start)} · ${formatTime(start)}`} />
          <Line label="Con" value={vet.name} />
          <Line label="Dónde" value={place === 'clinic' ? (vet.clinicAddress ?? 'En su consultorio') : 'En tu casa'} />
          <Line label="Precio de referencia" value={formatARS(priceFor(vet, place))} />
        </Card>
        <Field label="Motivo (opcional)" hint="Ayuda al veterinario a prepararse.">
          <TextField value={reason} onChangeText={setReason} placeholder="Ej: vacunas, control, no come hace 2 días" />
        </Field>
      </Screen>
    );
  }

  return <LoadingScreen />;
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
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
  small: {
    fontSize: font.small,
    color: colors.textMuted,
  },
  vet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  vetName: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.text,
  },
  price: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.primary,
  },
  line: {
    gap: 2,
  },
  lineLabel: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lineValue: {
    fontSize: font.subtitle,
    fontWeight: '600',
    color: colors.text,
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
  },
});
