// Auto's row (Ember 01-02): Auto at 84 beside Play's status word for his state (the status slot,
// 26/1 at Editorial) and the vendored chatCaption's detail under it — Geist Mono 12 in text2 for a
// running tool's input, Geist 12 otherwise. The words are the animation's text twin: VoiceOver
// reads the mascot as 'Auto, <caption>' and the words as one line, announced as they change.

import { StyleSheet, View } from 'react-native';

import type { CaptionFacts } from '../../../core/web/components/play/chat/caption';
import type { MascotName } from '../../../core/web/lib/mascot/types';
import { Text } from '../../../ui';
import { joinLabel } from '../../../ui/paint';
import { MASCOT_SIZES } from '../../mascot/geometry';
import { Mascot } from '../../mascot/Mascot';
import type { MascotController } from '../../mascot/use-mascot';
import { COMPANION, playStatus } from './model';
import { useCompanionPaint } from './use-companion';

export type AutoRowProps = {
  /** A state to hold, or the controller the chat feeds (useMascot()). */
  readonly state: MascotName | MascotController;
  /** What the chat knows beyond the state: the running tool's input, a Deliverable's kind. */
  readonly facts?: CaptionFacts;
};

const { autoRow } = COMPANION;

export function AutoRow({ state, facts }: AutoRowProps) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const shown = typeof state === 'string' ? state : state.driver.mascot.mascot;
  const status = playStatus(shown, facts);
  const { vars, style } = paint;
  const detailFace =
    status.detailFace === 'mono'
      ? style.type.mono(autoRow.detailSize)
      : style.type.body(autoRow.detailSize);
  return (
    <View style={[styles.row, { gap: autoRow.gap }]}>
      <Mascot size={MASCOT_SIZES.autoRow} state={state} />
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={joinLabel(status.word, status.detail)}
        accessibilityLiveRegion="polite"
        style={[styles.words, { gap: autoRow.wordGap }]}
      >
        <Text style={[style.type.display('status'), { color: vars.groundText }]}>
          {status.word}
        </Text>
        <Text numberOfLines={2} style={[detailFace, { color: vars.groundText2 }]}>
          {status.detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  words: { flexShrink: 1 },
});
