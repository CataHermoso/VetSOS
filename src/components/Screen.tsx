import { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  /** Scrollable + keyboard-aware, for forms. */
  scroll?: boolean;
  /** Pinned at the bottom (outside the scroll), e.g. the main button. */
  footer?: ReactNode;
};

/** Base layout for every screen: white background, safe area, side padding. */
export function Screen({ children, scroll, footer }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={styles.content}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
