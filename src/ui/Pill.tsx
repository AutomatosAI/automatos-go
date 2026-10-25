// The filter pill (the board's status filters, Deliverables' Awaiting | Done): 28 tall, 12 pt radius,
// Geist 500 12 pt, an optional status dot and mono count; solid ink when selected. VoiceOver hears
// the label and the count ('Blocked, 3') and the selected state. A5: the dress gives its height,
// radius, padding, label face, case and tracking and its paints (Play: Ember 04's round 40 pt chips,
// cream when chosen; HUD: square, the accent fill and a 1.5 pt accent line when chosen).

import { Pressable, StyleSheet, View } from 'react-native';

import { useDress } from '../styles/dress/use-dress';
import { useStyle } from '../styles/theme';
import type { ColourName } from '../styles/tokens';
import { Text } from './Text';
import { controlLabel, dressedPillPaint } from './dressed';
import { hitSlopFor, joinLabel } from './paint';
import { DOT_SIZE, PILL_COUNT_OPACITY } from './variants';

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
  const style = useStyle();
  const dress = useDress();
  const { colours, radii, spacing } = style.tokens;
  const { pill } = dress;
  const weight = selected ? pill.selectedWeight : pill.restWeight;
  const labelFace = controlLabel(style, dress, PILL_LABEL_LEVEL, weight);
  const ink = dressedPillPaint(dress, selected).color;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlopFor(pill.minHeight)}
      accessibilityRole="button"
      accessibilityLabel={joinLabel(label, count)}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => {
        const tone = dressedPillPaint(dress, selected, { pressed, disabled });
        return [
          styles.pill,
          {
            minHeight: pill.minHeight,
            paddingHorizontal: spacing[pill.paddingX],
            gap: spacing.space2,
            borderRadius: pill.radius,
            borderWidth: tone.borderWidth,
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
      <Text style={[labelFace, { color: ink }]}>{label}</Text>
      {count === undefined ? null : (
        <Text variant="mono" style={[styles.count, { color: ink }]}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  dot: { width: DOT_SIZE, height: DOT_SIZE },
  count: { opacity: PILL_COUNT_OPACITY },
});
