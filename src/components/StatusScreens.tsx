import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { SecondaryButton } from './Buttons';
import { Screen } from './Screen';
import { colors, font, spacing } from '@/theme';

export function LoadingScreen() {
  return (
    <Screen>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </Screen>
  );
}

export function MessageScreen({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {actionLabel && onAction ? <SecondaryButton label={actionLabel} onPress={onAction} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: font.title,
    fontWeight: '800',
    color: colors.text,
  },
  message: {
    fontSize: font.body,
    lineHeight: 24,
    color: colors.textMuted,
  },
});
