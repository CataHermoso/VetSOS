import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { colors, font, spacing } from '@/theme';

// Owner home: one huge emergency button, everything else is secondary.
export default function OwnerHome() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.logo}>VetSOS</Text>
        <Text style={styles.subtitle}>Ayuda veterinaria urgente, cerca tuyo.</Text>
      </View>

      <View style={styles.main}>
        <PrimaryButton
          label="EMERGENCIA VETERINARIA"
          hint="Tocá para buscar un veterinario de guardia"
          onPress={() => router.push('/owner/emergency')}
        />
      </View>

      <View style={styles.secondary}>
        <SecondaryButton label="Sacar turno" hint="Próximamente" disabled />
        <SecondaryButton label="Perfil" hint="Próximamente" disabled />
        <SecondaryButton label="Cambiar de modo" onPress={() => router.push('/?pick=1')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: spacing.lg,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: font.body,
    color: colors.textMuted,
  },
  main: {
    flex: 1,
    justifyContent: 'center',
  },
  secondary: {
    gap: spacing.sm,
  },
});
