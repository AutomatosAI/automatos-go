// The live transcript (D54, D-ONE-VOICE): the newest turn as two rows, the user's words in quotes
// (the style's sans 15/1.5 in text2) and Auto's (19/1.45 in text) with a 9 x 18 block cursor in the
// accent after them while he streams, blinking each second (step-end, as hudBlink) while loops run
// and lit and still while they may not. It opens with the AI label, the thread's one muted caption
// (D73); before the first words, First open's 'Say or type what you need.' (US-017f). Centred while it fits; past that the newest lines show and the oldest go off the top.

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Text } from '../../../ui';
import { AiLabel } from '../../ai-label';
import { useLayoutSize } from '../../ground/use-size';
import {
  HUD_CORE,
  transcriptAlign,
  transcriptHint,
  transcriptRows,
  type HudTurn,
  type TranscriptRow,
} from './model';
import { useLoop } from './use-loop';
import { useVoiceCore, type VoiceCore } from './use-voice-core';

const { transcript } = HUD_CORE;
const { cursor } = transcript;
/** hudBlink: lit for the first half of each second, dark for the second. */
const LIT_UNTIL = 0.5;

function Cursor({ core }: { readonly core: VoiceCore }) {
  const progress = useLoop(core.loops, cursor.blinkMs);
  const blink = useAnimatedStyle(() => ({ opacity: progress.get() < LIT_UNTIL ? 1 : 0 }));
  return (
    <Animated.View
      style={[
        {
          width: cursor.width,
          height: cursor.height,
          marginLeft: cursor.gap,
          backgroundColor: core.paint.accent,
        },
        blink,
      ]}
    />
  );
}

function Row({ row, core }: { readonly row: TranscriptRow; readonly core: VoiceCore }) {
  const { paint, style } = core;
  const spec = row.who === 'you' ? transcript.you : transcript.auto;
  const face = style.type.body(spec.size, 400, { leading: spec.leading });
  const colour = row.who === 'you' ? paint.text2 : paint.text;
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={row.label} style={styles.row}>
      {row.text ? (
        <Text selectable style={[face, styles.words, { color: colour }]}>
          {row.text}
        </Text>
      ) : null}
      {row.who === 'auto' && row.cursor ? <Cursor core={core} /> : null}
    </View>
  );
}

/** First open's words while the turn is empty: the user's line's face, in text2. */
function Hint({ turn, core }: { readonly turn: HudTurn; readonly core: VoiceCore }) {
  const hint = transcriptHint(turn);
  if (hint === null) return null;
  const face = core.style.type.body(transcript.you.size, 400, { leading: transcript.you.leading });
  return <Text style={[face, { color: core.paint.text2 }]}>{hint}</Text>;
}

export type TranscriptProps = { readonly turn: HudTurn };

export function Transcript({ turn }: TranscriptProps) {
  const core = useVoiceCore();
  const [box, onBoxLayout] = useLayoutSize();
  const [content, onContentLayout] = useLayoutSize();
  const align = box && content ? transcriptAlign(content.height, box.height) : 'center';
  return (
    <View
      onLayout={onBoxLayout}
      style={[
        styles.box,
        {
          paddingHorizontal: transcript.padX,
          justifyContent: align === 'end' ? 'flex-end' : 'center',
        },
      ]}
    >
      <View onLayout={onContentLayout} style={[styles.content, { gap: transcript.gap }]}>
        <AiLabel agent={turn.agent} />
        <Hint turn={turn} core={core} />
        {transcriptRows(turn).map((row) => (
          <Row key={row.who} row={row} core={core} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, overflow: 'hidden' },
  content: { flexShrink: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  words: { flexShrink: 1 },
});
