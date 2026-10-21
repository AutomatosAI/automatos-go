// The reason chip ('Waiting on your answer', 'Deliverable to review'): mono uppercase on the accent
// at 10 %, 3 pt radius. Other tones carry the Deliverables states (Review / Approved / Changes).
// Not interactive: the words are read as text.

import { StyleSheet, View } from 'react-native';

import { useTokens } from '../styles/theme';
import { Text } from './Text';
import { CHIP_PADDING_Y, tonePaint, type Tone } from './variants';

export type ChipProps = {
  readonly label: string;
  readonly tone?: Tone;
};

export function Chip({ label, tone = 'accent' }: ChipProps) {
  const { colours, radii, spacing } = useTokens();
  const { backgroundColor, color } = tonePaint(colours, tone);
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor,
          borderRadius: radii.chip,
          paddingHorizontal: spacing.space2,
          paddingVertical: CHIP_PADDING_Y,
        },
      ]}
    >
      <Text variant="mono" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start' },
});
