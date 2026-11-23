import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Chips } from '@/components/Chips';
import { formatTime } from '@/lib/format';
import { colors, font, spacing } from '@/theme';

import { Slot } from './api';
import { dayChip, dayKey } from './dates';

/** Pick a day (only days with free times), then a time. */
export function SlotPicker({ slots, selected, onSelect }: { slots: Slot[]; selected: Slot | null; onSelect: (slot: Slot) => void }) {
  const days = Array.from(new Map(slots.map((s) => [dayKey(new Date(s.startsAt)), new Date(s.startsAt)])).entries());
  const [day, setDay] = useState<string | null>(() => (selected ? dayKey(new Date(selected.startsAt)) : (days[0]?.[0] ?? null)));

  if (slots.length === 0) {
    return <Text style={styles.empty}>No tiene horarios libres en los próximos 14 días.</Text>;
  }

  const times = slots.filter((s) => dayKey(new Date(s.startsAt)) === day);

  return (
    <View style={styles.wrap}>
      <Chips scroll options={days.map(([key, d]) => ({ key, label: dayChip(d) }))} selected={day} onSelect={setDay} />
      <Chips
        options={times.map((s) => ({ key: s.startsAt, label: formatTime(new Date(s.startsAt)) }))}
        selected={selected?.startsAt ?? null}
        onSelect={(key) => {
          const slot = times.find((s) => s.startsAt === key);
          if (slot) onSelect(slot);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  empty: {
    fontSize: font.body,
    color: colors.textMuted,
  },
});
