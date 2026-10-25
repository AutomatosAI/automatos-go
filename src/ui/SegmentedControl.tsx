// The segmented control (cc-seg): a muted track with the chosen segment on card and the hairline
// shadow. Light / Dark / System, the digest's 07:00 / 08:00 / 09:00, Ask | Plan. A tab list to
// VoiceOver: the group has a label and each segment says whether it is selected. A5: the dress
// gives the label's face, case and tracking and the paints (Play: the chosen segment cream, HUD:
// the accent fill); the radii are the style's.

import { Pressable, StyleSheet, View } from 'react-native';

import { useDress } from '../styles/dress/use-dress';
import { useStyle } from '../styles/theme';
import { Text } from './Text';
import { controlLabel, dressedSegmentPaint } from './dressed';
import { MIN_TOUCH } from './paint';
import { SEGMENT_GAP, SEGMENT_PADDING_Y, SEGMENT_TRACK_INSET } from './variants';

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
  const style = useStyle();
  const dress = useDress();
  const { radii, spacing, shadows } = style.tokens;
  const { segment } = dress.paints;
  const labelFace = controlLabel(style, dress, SEGMENT_LABEL_LEVEL);
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.track,
        {
          backgroundColor: segment.track,
          borderRadius: radii.control,
          padding: SEGMENT_TRACK_INSET,
          gap: SEGMENT_GAP,
        },
      ]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const tone = dressedSegmentPaint(dress, selected);
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
                backgroundColor: tone.background,
                borderRadius: radii.segment,
                paddingVertical: SEGMENT_PADDING_Y,
                paddingHorizontal: spacing.space4,
                boxShadow: selected && segment.selectedShadow ? shadows.hairline : undefined,
              },
            ]}
          >
            <Text style={[labelFace, { color: tone.foreground }]}>{option.label}</Text>
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
