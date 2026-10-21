// The filter pill (the board's status filters, Deliverables' Awaiting | Done): 28 tall, 12 pt radius,
// Geist 500 12 pt, an optional status dot and mono count; solid ink when selected. VoiceOver hears
// the label and the count ('Blocked, 3') and the selected state.

import { Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '../styles/theme';
import type { ColourName } from '../styles/tokens';
import { Text } from './Text';
import { hitSlopFor, joinLabel } from './paint';
import {
  BUTTON_LABEL_WEIGHT,
  DOT_SIZE,
  PILL_COUNT_OPACITY,
  PILL_HEIGHT,
  pillPaint,
} from './variants';

const PILL_LABEL_LEVEL = 5;

export type PillProps = {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly count?: number;
  /** The status dot's colour token (the board's column dots: PIP_TOKENS). */
  readonly dot?: ColourName;
  readonly disabled?: boolean;
};

export function Pill({ label, selected, onPress, count, dot, disabled = false }: PillProps) {
  const { colours, radii, spacing } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlopFor(PILL_HEIGHT)}
      accessibilityRole="button"
      accessibilityLabel={joinLabel(label, count)}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => {
        const tone = pillPaint(colours, selected, { pressed, disabled });
        return [
          styles.pill,
          {
            minHeight: PILL_HEIGHT,
            paddingHorizontal: spacing.space4,
            gap: spacing.space2,
            borderRadius: radii.pill,
            backgroundColor: tone.backgroundColor,
            borderColor: tone.borderColor,
            opacity: tone.opacity,
          },
        ];
      }}
    >
      {dot ? (
        <View style={[styles.dot, { backgroundColor: colours[dot], borderRadius: radii.full }]} />
      ) : null}
      <Text
        level={PILL_LABEL_LEVEL}
        weight={BUTTON_LABEL_WEIGHT}
        style={{ color: pillPaint(colours, selected).color }}
      >
        {label}
      </Text>
      {count === undefined ? null : (
        <Text variant="mono" style={[styles.count, { color: pillPaint(colours, selected).color }]}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, alignSelf: 'flex-start' },
  dot: { width: DOT_SIZE, height: DOT_SIZE },
  count: { opacity: PILL_COUNT_OPACITY },
});
