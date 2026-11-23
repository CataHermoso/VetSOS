import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

type ChipOption = { key: string; label: string };

/** A row of small selectable pills. `scroll` = one horizontal line; otherwise they wrap. */
export function Chips({
  options,
  selected,
  onSelect,
  scroll,
}: {
  options: ChipOption[];
  selected: string | null;
  onSelect: (key: string) => void;
  scroll?: boolean;
}) {
  const chips = options.map((o) => {
    const isSelected = o.key === selected;
    return (
      <Pressable
        key={o.key}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        onPress={() => onSelect(o.key)}
        style={[styles.chip, isSelected && styles.chipSelected]}
      >
        <Text style={[styles.text, isSelected && styles.textSelected]}>{o.label}</Text>
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={[styles.row, styles.wrap]}>{chips}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  text: {
    fontSize: font.body,
    fontWeight: '600',
    color: colors.textMuted,
  },
  textSelected: {
    color: colors.primary,
  },
});
