// "Auto is writing" in Candy (CANDY-LAYOUT §4 P2; the kit's chat/entries.tsx WritingChip at
// 3920359d5): a 36 pt chip-fill capsule with three 7 pt dots in the three cards' starts and the
// words in Nunito 700 12, quiet. The dots bounce (writing.ts dotLiftAt) on Candy's one clock only
// while Candy moves, and rest under Reduce Motion, the look's Motion or the pause control; the
// words are always there, the bounce's text twin (D-A11Y). VoiceOver hears the words alone. A
// screen that mounts it draws CandyPauseButton (D-CAN-5; the pause-reach test).

import { StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { CANDY_LEADING, CANDY_MIN } from '../../typeface/candy-type';
import { clockMs } from '../auto/clock';
import { useCandyTick } from '../auto/use-auto-motion';
import { CANDY_COPY } from '../strings';
import { useCandyMotion } from '../use-candy-motion';
import { useCandyPaint } from './use-candy-paint';
import { WRITING, WRITING_DOTS, dotLiftAt } from './writing';

export function WritingChip() {
  const { vars, type, round } = useCandyPaint();
  const { moving } = useCandyMotion();
  const tick = useCandyTick(moving);
  const ms = moving ? clockMs(tick) : 0;
  const face = type.body(CANDY_MIN, 700, { leading: CANDY_LEADING.label });
  return (
    <View
      accessible
      accessibilityLabel={CANDY_COPY.writing}
      style={[styles.chip, { borderRadius: round, backgroundColor: vars.chip }]}
    >
      <View style={styles.dots}>
        {WRITING_DOTS.map((dot, index) => (
          <View
            key={dot}
            style={[
              styles.dot,
              { backgroundColor: vars[dot] },
              { transform: [{ translateY: moving ? dotLiftAt(ms, index) : 0 }] },
            ]}
          />
        ))}
      </View>
      <Text style={[face, { color: vars.quiet }]}>{CANDY_COPY.writing}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: WRITING.gap,
    minHeight: WRITING.height,
    paddingHorizontal: WRITING.padH,
  },
  dots: { flexDirection: 'row', gap: WRITING.dotGap },
  dot: { width: WRITING.dot, height: WRITING.dot, borderRadius: WRITING.dot / 2 },
});
