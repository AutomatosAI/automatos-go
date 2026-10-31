// A status in Candy (CANDY-LAYOUT §4 P4, the README's 'Status'; the kit's ui/ui.module.css .chip
// at 3920359d5): always a glyph and a word, never colour alone (D-A11Y) — '● Working' on the chip
// fill in text while active, '○ Ready' in quiet text on nothing while resting (chips.ts
// statusChipOf), 26 pt tall and growing with the text, in Nunito 800 12 (the design's 11 is 12).
// VoiceOver hears the word, never the glyph.

import { StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { CANDY_LEADING, CANDY_MIN } from '../../typeface/candy-type';
import { STATUS_CHIP, statusChipOf } from './chips';
import { useCandyPaint } from './use-candy-paint';

export type StatusChipProps = {
  /** Working or needing you: the filled glyph on the chip fill; resting: the open one, quiet. */
  readonly active: boolean;
  /** The status in words ('Working', 'Needs you', 'Ready'). */
  readonly word: string;
};

export function StatusChip({ active, word }: StatusChipProps) {
  const { vars, type, round } = useCandyPaint();
  const chip = statusChipOf(active, word);
  const face = type.body(CANDY_MIN, 800, { leading: CANDY_LEADING.label });
  return (
    <View
      accessible
      accessibilityLabel={chip.word}
      style={[
        styles.chip,
        { borderRadius: round },
        chip.fill ? { backgroundColor: vars[chip.fill] } : null,
      ]}
    >
      <Text style={[face, { color: vars[chip.ink] }]}>{`${chip.glyph} ${chip.word}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: STATUS_CHIP.height,
    paddingHorizontal: STATUS_CHIP.padH,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
