import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Form';
import { PriceLine } from '@/features/emergency/prices';
import { formatARS } from '@/lib/format';
import { colors, font, spacing } from '@/theme';

/** "Precio de referencia" box: one line per item and a "Desde" total. */
export function PriceCard({ lines, total, note }: { lines: PriceLine[]; total: number; note?: string }) {
  return (
    <Card>
      <Text style={styles.label}>Precio de referencia</Text>
      {lines.map((l) => (
        <View key={l.label} style={styles.row}>
          <Text style={styles.body}>{l.label}</Text>
          <Text style={styles.body}>{formatARS(l.amount)}</Text>
        </View>
      ))}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={styles.total}>Desde</Text>
        <Text style={styles.total}>{formatARS(total)}</Text>
      </View>
      {note ? <Text style={styles.small}>{note}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  body: {
    fontSize: font.body,
    lineHeight: 22,
    color: colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  total: {
    fontSize: font.subtitle,
    fontWeight: '800',
    color: colors.text,
  },
  small: {
    fontSize: font.small,
    color: colors.textMuted,
  },
});
