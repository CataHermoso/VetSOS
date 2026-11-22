import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { SecondaryButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { colors, font, radius, spacing } from '@/theme';

// Placeholder for the emergency flow (milestone 3: setup, confirm, search).
export default function EmergencyPlaceholder() {
  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>En construcción</Text>
        </View>
        <Text style={styles.title}>Acá vamos a buscar un veterinario de guardia</Text>
        <Text style={styles.body}>
          Próximos pasos: tu ubicación, si tenés cómo trasladar a tu mascota, y la búsqueda del
          veterinario más cercano.
        </Text>
      </View>

      <SecondaryButton label="Volver al inicio" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: font.small,
  },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    fontSize: font.body,
    lineHeight: 24,
    color: colors.textMuted,
  },
});
