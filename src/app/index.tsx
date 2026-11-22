import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { colors, font, radius, spacing } from '@/theme';

// Temporary entry screen: pick a role. Once logins exist (milestone 2),
// the app will remember the role and skip this screen.
export default function RolePicker() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.logo}>VetSOS</Text>
        <Text style={styles.subtitle}>¿Cómo querés usar la app?</Text>
      </View>

      <View style={styles.options}>
        <RoleCard
          title="Tengo una mascota"
          description="Pedí ayuda veterinaria urgente."
          onPress={() => router.push('/owner')}
        />
        <RoleCard
          title="Soy veterinario/a"
          description="Ponete de guardia y recibí urgencias cerca tuyo."
          onPress={() => router.push('/vet')}
        />
      </View>
    </Screen>
  );
}

function RoleCard({
  title,
  description,
  onPress,
}: {
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.primary,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: font.subtitle,
    color: colors.textMuted,
  },
  options: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  cardDescription: {
    marginTop: spacing.xs,
    fontSize: font.body,
    color: colors.textMuted,
  },
});
