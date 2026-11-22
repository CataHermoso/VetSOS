import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  hint?: string;
  disabled?: boolean;
};

/**
 * The one main action of a screen, violet.
 * size "hero" = the huge emergency-style button; "normal" = form submit size.
 */
export function PrimaryButton({
  label,
  onPress,
  hint,
  disabled,
  size = 'hero',
}: ButtonProps & { size?: 'hero' | 'normal' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        size === 'normal' && styles.primaryNormal,
        pressed && styles.primaryPressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.primaryLabel, size === 'normal' && styles.primaryLabelNormal]}>{label}</Text>
      {hint ? <Text style={styles.primaryHint}>{hint}</Text> : null}
    </Pressable>
  );
}

/** Low-emphasis action, e.g. "Perfil". */
export function SecondaryButton({ label, onPress, hint, disabled }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, pressed && styles.secondaryPressed]}
    >
      <View style={styles.secondaryRow}>
        <Text style={[styles.secondaryLabel, disabled && styles.mutedText]}>{label}</Text>
        {hint ? <Text style={styles.secondaryHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryNormal: {
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryLabelNormal: {
    fontSize: font.subtitle,
    fontWeight: '700',
    letterSpacing: 0,
  },
  primaryPressed: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  primaryLabel: {
    color: colors.onPrimary,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  primaryHint: {
    color: colors.onPrimary,
    opacity: 0.85,
    fontSize: font.small,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  secondaryPressed: {
    backgroundColor: colors.surface,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondaryLabel: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600',
  },
  mutedText: {
    color: colors.textMuted,
  },
  secondaryHint: {
    color: colors.textMuted,
    fontSize: font.small,
  },
});
