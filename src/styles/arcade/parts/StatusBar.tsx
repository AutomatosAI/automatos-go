// The handheld's status bar (README 'Pages'; the design kit's frame/screen-bar.tsx, status-bar.tsx
// and today.tsx; the 'Phone 390' screen's top strip): on the bar's ground over a 2 pt line in the
// window border, Auto's mark (still, 32 pt) and the AUTOMATOS wordmark (the handheld's 9 px
// wordmark at Arcade's 11 pt label step), today's counters — XP, ! and QUEST, each a game word in
// its game colour and a number on a window-ground chip, said in words ('3 done today'; a counter
// the home cannot know is left out) — and the pause control (WCAG 2.2.2; none under Reduce
// Motion). The pieces wrap onto a second line when the phone's width or text size leaves no room
// for one, so nothing is cut.

import { StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { ARCADE_COPY } from '../../strings';
import { PauseButton } from '../PauseButton';
import { PixelSprite } from '../sprite/PixelSprite';
import { statusCounters, type Counter, type CounterValues } from './counters';
import { useArcadePaint } from './use-arcade-paint';

/** The phone's screen bar: 8 / 10 pt padding, 8 pt between pieces, 6 between the chips. */
const BAR = Object.freeze({ padV: 8, padH: 10, gap: 8, rule: 2, chipGap: 6 });
/** A counter's chip: the window ground, the window border inside, 4 / 7 pt padding. */
const CHIP = Object.freeze({ padV: 4, padH: 7, gap: 5, ring: 2 });

function Wordmark() {
  const { vars, type } = useArcadePaint();
  return (
    <View style={styles.wordmark}>
      <PixelSprite state="idle" view="mark" still />
      <Text
        accessibilityRole="header"
        accessibilityLabel={ARCADE_COPY.brandLabel}
        style={[type.label, { color: vars.barTx }]}
      >
        {ARCADE_COPY.brand}
      </Text>
    </View>
  );
}

function CounterChip({ counter }: { readonly counter: Counter }) {
  const { vars, type } = useArcadePaint();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={counter.label}
      style={[styles.chip, { backgroundColor: vars.win, borderColor: vars.bd }]}
    >
      <Text style={[type.label, { color: vars[counter.tone] }]}>{counter.game}</Text>
      <Text style={[type.display('number'), { color: vars.tx }]}>{counter.value}</Text>
    </View>
  );
}

export type StatusBarProps = {
  /** Today's numbers; null leaves that counter out. */
  readonly counters: CounterValues;
  /** The pause control at the bar's end (shown unless false). */
  readonly pause?: boolean;
};

export function StatusBar({ counters, pause = true }: StatusBarProps) {
  const { vars } = useArcadePaint();
  const shown = statusCounters(counters);
  return (
    <View style={[styles.bar, { backgroundColor: vars.bar, borderBottomColor: vars.bd }]}>
      <Wordmark />
      {shown.length > 0 ? (
        <View style={styles.counters}>
          {shown.map((counter) => (
            <CounterChip key={counter.key} counter={counter} />
          ))}
        </View>
      ) : null}
      {pause ? <PauseButton /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: BAR.gap,
    paddingVertical: BAR.padV,
    paddingHorizontal: BAR.padH,
    borderBottomWidth: BAR.rule,
  },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: BAR.gap, flexShrink: 1 },
  counters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: BAR.chipGap,
    flexShrink: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CHIP.gap,
    paddingVertical: CHIP.padV,
    paddingHorizontal: CHIP.padH,
    borderWidth: CHIP.ring,
  },
});
