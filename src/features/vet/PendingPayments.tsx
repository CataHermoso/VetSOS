import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Form';
import { apiErrorMessage } from '@/features/emergency/api';
import { formatARS } from '@/lib/format';
import { colors, font, spacing } from '@/theme';

import { PendingPayment, fetchPendingPayments, setPaymentStatus } from './api';

/** Cases closed with "pago pendiente": the vet marks them paid when the transfer arrives. Hidden when empty. */
export function PendingPayments({ userId }: { userId: string }) {
  const [items, setItems] = useState<PendingPayment[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchPendingPayments(userId)
        .then((list) => {
          if (!cancelled) setItems(list);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  async function markPaid(id: string) {
    setSaving(id);
    setError(null);
    try {
      await setPaymentStatus(id, 'paid');
      setItems((list) => list.filter((p) => p.emergencyId !== id));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <Card>
      <Text style={styles.label}>Pagos pendientes</Text>
      {items.map((p) => (
        <View key={p.emergencyId} style={styles.row}>
          <Text style={styles.text}>
            {p.ownerFirstName} · {formatARS(p.amount)}
          </Text>
          <Text
            accessibilityRole="button"
            style={[styles.action, saving === p.emergencyId && styles.disabled]}
            onPress={saving ? undefined : () => markPaid(p.emergencyId)}
          >
            {saving === p.emergencyId ? 'Guardando…' : 'Ya me pagó'}
          </Text>
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  text: {
    flexShrink: 1,
    fontSize: font.body,
    color: colors.text,
  },
  action: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.primary,
    paddingVertical: spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
  },
});
