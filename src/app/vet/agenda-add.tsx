import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Chips } from '@/components/Chips';
import { PrimaryButton } from '@/components/Buttons';
import { Choice, Field, TextField } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { Slot, addManualAppointment, appointmentErrorMessage, getFreeSlots } from '@/features/appointments/api';
import { dayChip, dayKey, nextDays, parseHHMM } from '@/features/appointments/dates';
import { Place } from '@/features/emergency/types';
import { formatTime } from '@/lib/format';
import { useSession } from '@/lib/session';
import { colors, font, spacing } from '@/theme';

const OTHER = 'other';

// "Agregar turno": someone called to book. Pick a free time (or any other time) and who it is.
export default function AddAppointmentScreen() {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;

  const [days] = useState(() => nextDays(14));
  const [day, setDay] = useState(dayKey(days[0]));
  const [place, setPlace] = useState<Place>('clinic');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [time, setTime] = useState<string | null>(null); // a slot's startsAt, or OTHER
  const [otherTime, setOtherTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free times for this place (from the vet's own hours).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getFreeSlots(userId, place)
      .then((s) => {
        if (!cancelled) setSlots(s);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, place]);

  const daySlots = slots.filter((s) => dayKey(new Date(s.startsAt)) === day);

  async function save() {
    setError(null);
    let startsAt: Date | null = null;
    if (time === OTHER) {
      const hhmm = parseHHMM(otherTime);
      if (!hhmm) return setError('Escribí la hora así: 16:30.');
      const d = days.find((x) => dayKey(x) === day)!;
      const [h, m] = hhmm.split(':').map(Number);
      startsAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
    } else if (time) {
      startsAt = new Date(time);
    }
    if (!startsAt) return setError('Elegí el horario.');
    if (startsAt.getTime() < Date.now()) return setError('Ese horario ya pasó.');
    if (!name.trim()) return setError('Escribí el nombre de quien pidió el turno.');

    setSaving(true);
    try {
      await addManualAppointment({ startsAt, place, name, phone, note });
      if (router.canGoBack()) router.back();
      else router.replace('/vet/agenda');
    } catch (e) {
      setError(appointmentErrorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Screen
      scroll
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton size="normal" label={saving ? 'Guardando…' : 'Guardar turno'} onPress={save} disabled={saving} />
        </>
      }
    >
      <Field label="Día">
        <Chips
          scroll
          options={days.map((d) => ({ key: dayKey(d), label: dayChip(d) }))}
          selected={day}
          onSelect={(k) => {
            setDay(k);
            setTime(null);
          }}
        />
      </Field>

      <Field label="Dónde">
        <Choice
          options={[
            { value: 'clinic', label: 'Consultorio' },
            { value: 'home', label: 'A domicilio' },
          ]}
          value={place}
          onChange={(p) => {
            setPlace(p);
            setTime(null);
          }}
        />
      </Field>

      <Field label="Horario" hint={daySlots.length === 0 ? 'No tenés horarios libres cargados ese día: elegí "Otro horario".' : undefined}>
        <Chips
          options={[
            ...daySlots.map((s) => ({ key: s.startsAt, label: formatTime(new Date(s.startsAt)) })),
            { key: OTHER, label: 'Otro horario' },
          ]}
          selected={time}
          onSelect={setTime}
        />
        {time === OTHER ? (
          <TextField value={otherTime} onChangeText={setOtherTime} placeholder="16:30" keyboardType="numbers-and-punctuation" />
        ) : null}
      </Field>

      <View style={styles.section}>
        <Field label="Nombre">
          <TextField value={name} onChangeText={setName} placeholder="Quién pidió el turno" />
        </Field>
        <Field label="Teléfono (opcional)">
          <TextField value={phone} onChangeText={setPhone} placeholder="11 1234-5678" keyboardType="phone-pad" />
        </Field>
        <Field label="Nota (opcional)">
          <TextField value={note} onChangeText={setNote} placeholder="Ej: control de vacunas, perro grande" />
        </Field>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.lg,
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
    textAlign: 'center',
  },
});
