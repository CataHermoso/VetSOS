import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textMuted} {...props} style={[styles.input, props.style]} />;
}

/** Two or three big options, one selected (e.g. Sí / No). */
export function Choice<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.choiceRow}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.choice, selected && styles.choiceSelected]}
          >
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Light violet box for grouped info. */
export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    fontSize: font.small,
    color: colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: font.body,
    color: colors.text,
    backgroundColor: colors.background,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choice: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceText: {
    fontSize: font.body,
    fontWeight: '600',
    color: colors.textMuted,
  },
  choiceTextSelected: {
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
