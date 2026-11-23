import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Card, Choice, Field, TextField } from '@/components/Form';
import { Screen } from '@/components/Screen';
import { LoadingScreen } from '@/components/StatusScreens';
import { Chips } from '@/components/Chips';
import {
  ScheduleRow,
  addScheduleRow,
  appointmentErrorMessage,
  loadAppointmentSettings,
  loadSchedule,
  removeScheduleRow,
  saveSlotMinutes,
} from '@/features/appointments/api';
import { WEEKDAYS, WEEKDAYS_SHORT, parseHHMM } from '@/features/appointments/dates';
import { Place, ServiceMode } from '@/features/emergency/types';
import { formatARS } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, font, spacing } from '@/theme';

const PLACE_TEXT: Record<Place, string> = { clinic: 'Consultorio', home: 'A domicilio' };
const LENGTHS = [20, 30, 45, 60];
// Monday first, the way people read a week.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// "Mis horarios": when the vet takes appointments, and how long each one is.
export default function ScheduleScreen() {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;

  const [rows, setRows] = useState<ScheduleRow[] | null>(null);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [price, setPrice] = useState<number | null>(null);
  const [serviceMode, setServiceMode] = useState<ServiceMode>('both');
  const [error, setError] = useState<string | null>(null);

  // New row form
  const [weekday, setWeekday] = useState<number | null>(null);
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('13:00');
  const [place, setPlace] = useState<Place>('clinic');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [list, settings, vet] = await Promise.all([
      loadSchedule(userId),
      loadAppointmentSettings(userId),
      supabase.from('vets').select('service_mode').eq('profile_id', userId).maybeSingle(),
    ]);
    setRows(list);
    setSlotMinutes(settings.slotMinutes);
    setPrice(settings.price);
    const mode = (vet.data?.service_mode as ServiceMode | undefined) ?? 'both';
    setServiceMode(mode);
    if (mode === 'home') setPlace('home');
    if (mode === 'clinic') setPlace('clinic');
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => setError(appointmentErrorMessage(e)));
    }, [reload]),
  );

  async function changeLength(minutes: number) {
    if (!userId) return;
    setSlotMinutes(minutes);
    saveSlotMinutes(userId, minutes).catch((e) => setError(appointmentErrorMessage(e)));
  }

  async function add() {
    if (!userId) return;
    setError(null);
    const start = parseHHMM(from);
    const end = parseHHMM(to);
    if (weekday === null) return setError('Elegí el día.');
    if (!start || !end) return setError('Escribí las horas así: 09:00.');
    if (end <= start) return setError('La hora de fin tiene que ser después de la de inicio.');
    setSaving(true);
    try {
      await addScheduleRow(userId, { weekday, startTime: start, endTime: end, place });
      await reload();
    } catch (e) {
      setError(appointmentErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await removeScheduleRow(id);
      await reload();
    } catch (e) {
      setError(appointmentErrorMessage(e));
    }
  }

  if (!rows) return <LoadingScreen />;

  const placeOptions: { value: Place; label: string }[] = [
    ...(serviceMode !== 'home' ? [{ value: 'clinic' as const, label: 'Consultorio' }] : []),
    ...(serviceMode !== 'clinic' ? [{ value: 'home' as const, label: 'A domicilio' }] : []),
  ];
  const sorted = [...rows].sort((a, b) => WEEK_ORDER.indexOf(a.weekday) - WEEK_ORDER.indexOf(b.weekday) || a.startTime.localeCompare(b.startTime));

  return (
    <Screen
      scroll
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton size="normal" label={saving ? 'Agregando…' : 'Agregar horario'} onPress={add} disabled={saving} />
        </>
      }
    >
      {price === null ? (
        <Card>
          <Text style={styles.body}>
            Para que te puedan pedir turnos, cargá el precio de la «Consulta con turno» en tu perfil.
          </Text>
          <SecondaryButton label="Ir a Mi perfil" onPress={() => router.push('/vet/profile')} />
        </Card>
      ) : (
        <Text style={styles.note}>Consulta con turno: {formatARS(price)} (se cambia en Mi perfil).</Text>
      )}

      <Field label="Duración de cada turno">
        <Chips
          options={LENGTHS.map((m) => ({ key: String(m), label: `${m} min` }))}
          selected={String(slotMinutes)}
          onSelect={(k) => changeLength(Number(k))}
        />
      </Field>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tus horarios</Text>
        {sorted.length === 0 ? (
          <Text style={styles.note}>Todavía no cargaste horarios. Agregá el primero abajo.</Text>
        ) : (
          sorted.map((r) => (
            <View key={r.id} style={styles.row}>
              <Text style={styles.rowText}>
                {WEEKDAYS[r.weekday]} · {r.startTime}–{r.endTime} · {PLACE_TEXT[r.place]}
              </Text>
              <Text accessibilityRole="button" style={styles.remove} onPress={() => remove(r.id)}>
                Quitar
              </Text>
            </View>
          ))
        )}
      </View>

      <Card>
        <Text style={styles.cardLabel}>Agregar horario</Text>
        <Chips
          options={WEEK_ORDER.map((d) => ({ key: String(d), label: WEEKDAYS_SHORT[d] }))}
          selected={weekday === null ? null : String(weekday)}
          onSelect={(k) => setWeekday(Number(k))}
        />
        <View style={styles.times}>
          <View style={styles.flex}>
            <Field label="Desde">
              <TextField value={from} onChangeText={setFrom} placeholder="09:00" keyboardType="numbers-and-punctuation" />
            </Field>
          </View>
          <View style={styles.flex}>
            <Field label="Hasta">
              <TextField value={to} onChangeText={setTo} placeholder="13:00" keyboardType="numbers-and-punctuation" />
            </Field>
          </View>
        </View>
        {placeOptions.length > 1 ? <Choice options={placeOptions} value={place} onChange={setPlace} /> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: font.subtitle + 2,
    fontWeight: '800',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  rowText: {
    flexShrink: 1,
    fontSize: font.body,
    color: colors.text,
  },
  remove: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.warning,
    paddingVertical: spacing.xs,
  },
  times: {
    flexDirection: 'row',
    gap: spacing.md,
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
  note: {
    fontSize: font.small,
    color: colors.textMuted,
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
    textAlign: 'center',
  },
});
