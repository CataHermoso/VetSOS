import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { colors, font, radius, spacing } from '@/theme';

// Vet home: one big availability switch.
// For now it only changes on this phone; milestone 5 connects it to the server.
export default function VetHome() {
  const [available, setAvailable] = useState(false);

  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.label}>Tu estado</Text>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: available }}
          onPress={() => setAvailable((v) => !v)}
          style={({ pressed }) => [
            styles.toggle,
            available ? styles.toggleOn : styles.toggleOff,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.dot, available ? styles.dotOn : styles.dotOff]} />
          <Text style={[styles.toggleText, available && styles.toggleTextOn]}>
            {available ? 'Disponible' : 'No disponible'}
          </Text>
        </Pressable>

        <Text style={styles.help}>
          {available
            ? 'Estás de guardia. Te van a llegar urgencias cercanas compatibles con tu forma de atender.'
            : 'Tocá para ponerte de guardia. Podés pausarla cuando quieras.'}
        </Text>
      </View>
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
});
