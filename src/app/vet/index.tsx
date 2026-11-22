import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SecondaryButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { errorMessage, useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, spacing } from '@/theme';

type VetStatus = 'offline' | 'available' | 'busy';

// Vet home: one big availability switch, saved in the database.
// (Location and receiving emergencies come in milestone 5.)
export default function VetHome() {
  const session = useSession();
  const userId = session.status === 'ready' ? session.userId : null;

  const [status, setStatus] = useState<VetStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('vets')
      .select('status')
      .eq('profile_id', userId)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (loadError) setError(loadError.message);
        else setStatus((data?.status as VetStatus | undefined) ?? 'offline');
      });
  }, [userId]);

  async function toggle() {
    if (!userId || status === null || status === 'busy') return;
    const next: VetStatus = status === 'available' ? 'offline' : 'available';
    setSaving(true);
    setError(null);
    try {
      const { error: saveError } = await supabase
        .from('vets')
        .update({ status: next, last_seen_at: new Date().toISOString() })
        .eq('profile_id', userId);
      if (saveError) throw saveError;
      setStatus(next);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const available = status === 'available';

  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.label}>Tu estado</Text>

        {status === null && !error ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: available, busy: saving }}
            disabled={saving || status === null}
            onPress={toggle}
            style={({ pressed }) => [
              styles.toggle,
              available ? styles.toggleOn : styles.toggleOff,
              (pressed || saving) && styles.pressed,
            ]}
          >
            <View style={[styles.dot, available ? styles.dotOn : styles.dotOff]} />
            <Text style={[styles.toggleText, available && styles.toggleTextOn]}>
              {available ? 'Disponible' : 'No disponible'}
            </Text>
          </Pressable>
        )}

        <Text style={styles.help}>
          {available
            ? 'Estás de guardia. Te van a llegar urgencias cercanas compatibles con tu forma de atender.'
            : 'Tocá para ponerte de guardia. Podés pausarla cuando quieras.'}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <SecondaryButton label="Cambiar de modo" onPress={() => router.push('/?pick=1')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  label: {
    fontSize: font.subtitle,
    color: colors.textMuted,
    textAlign: 'center',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    borderRadius: radius.xl,
    paddingVertical: spacing.xxl,
    borderWidth: 2,
  },
  toggleOn: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  toggleOff: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
  },
  dotOn: {
    backgroundColor: colors.success,
  },
  dotOff: {
    backgroundColor: colors.textMuted,
  },
  toggleText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textMuted,
  },
  toggleTextOn: {
    color: colors.success,
  },
  help: {
    fontSize: font.body,
    lineHeight: 24,
    color: colors.textMuted,
    textAlign: 'center',
  },
  error: {
    color: colors.warning,
    fontSize: font.small,
    textAlign: 'center',
  },
});
