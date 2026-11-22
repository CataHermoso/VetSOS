import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { LoadingScreen, MessageScreen } from '@/components/StatusScreens';
import { errorMessage, Role, useSession } from '@/lib/session';
import { colors, font, radius, spacing } from '@/theme';

const HOME: Record<Role, '/owner' | '/vet'> = { owner: '/owner', vet: '/vet' };

// Entry screen. If the role is already saved, go straight to that home.
// `/?pick=1` forces the picker (used by "Cambiar de modo").
export default function RolePicker() {
  const session = useSession();
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const [saving, setSaving] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session.status === 'loading') return <LoadingScreen />;

  if (session.status === 'unconfigured') {
    return (
      <MessageScreen
        title="Falta configurar Supabase"
        message="Completá EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el archivo .env.local y reiniciá `npx expo start`."
      />
    );
  }

  if (session.status === 'error') {
    return (
      <MessageScreen
        title="No pudimos conectarnos"
        message={session.message}
        actionLabel="Reintentar"
        onAction={session.retry}
      />
    );
  }

  if (session.role && !pick) return <Redirect href={HOME[session.role]} />;

  async function choose(role: Role) {
    setSaving(role);
    setError(null);
    try {
      await session.setRole(role);
      router.replace(HOME[role]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(null);
    }
  }

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
          loading={saving === 'owner'}
          disabled={saving !== null}
          onPress={() => choose('owner')}
        />
        <RoleCard
          title="Soy veterinario/a"
          description="Ponete de guardia y recibí urgencias cerca tuyo."
          loading={saving === 'vet'}
          disabled={saving !== null}
          onPress={() => choose('vet')}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

function RoleCard({
  title,
  description,
  loading,
  disabled,
  onPress,
}: {
  title: string;
  description: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
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
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  error: {
    marginTop: spacing.lg,
    color: colors.warning,
    fontSize: font.small,
  },
});
