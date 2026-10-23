// The segmented control (cc-seg): a muted track with the chosen segment on card and the hairline
// shadow. Light / Dark / System, the digest's 07:00 / 08:00 / 09:00, Ask | Plan. A tab list to
// VoiceOver: the group has a label and each segment says whether it is selected.

import { Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '../styles/theme';
import { Text } from './Text';
import { MIN_TOUCH } from './paint';
import {
  BUTTON_LABEL_WEIGHT,
  SEGMENT_GAP,
  SEGMENT_PADDING_Y,
  SEGMENT_TRACK_INSET,
  segmentPaint,
} from './variants';

const SEGMENT_LABEL_LEVEL = 6;
const SEGMENT_SLOP = Object.freeze({ top: SEGMENT_TRACK_INSET, bottom: SEGMENT_TRACK_INSET });

export type SegmentOption<T extends string> = { readonly value: T; readonly label: string };

export type SegmentedControlProps<T extends string> = {
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** What the group chooses ('Digest time'). */
  readonly accessibilityLabel: string;
  readonly disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
}: SegmentedControlProps<T>) {
  const { colours, radii, spacing, shadows } = useTokens();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        {
          backgroundColor: colours.muted,
          borderRadius: radii.control,
          padding: SEGMENT_TRACK_INSET,
          gap: SEGMENT_GAP,
        },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const tone = segmentPaint(colours, selected);
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            hitSlop={SEGMENT_SLOP}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            style={[
              styles.segment,
              {
                backgroundColor: tone.backgroundColor,
                borderRadius: radii.segment,
                paddingVertical: SEGMENT_PADDING_Y,
                paddingHorizontal: spacing.space4,
                boxShadow: selected ? shadows.hairline : undefined,
              },
            ]}
          >
            <Text
              level={SEGMENT_LABEL_LEVEL}
              weight={BUTTON_LABEL_WEIGHT}
              style={{ color: tone.color }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignSelf: 'flex-start' },
  segment: { alignItems: 'center', justifyContent: 'center', minWidth: MIN_TOUCH },
});
