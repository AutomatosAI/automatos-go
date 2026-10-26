// The live transcript (D54, D-ONE-VOICE): the newest turn as two rows, the user's words in quotes
// (the style's sans 15/1.5 in text2) and Auto's (19/1.45 in text) with a 9 x 18 block cursor in the
// accent after them while he streams, blinking each second (step-end, as hudBlink) while loops run
// and lit and still while they may not. It opens with the AI label, the thread's one muted caption
// (D73); before the first words, First open's 'Say or type what you need.' (US-017f). Centred while it
// fits; past that it scrolls, showing the newest lines: new words scroll it down while the person
// reads its end (transcriptAtEnd), and it stays put once they scroll up to read the start. A new
// turn opens at its end again.

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { Text } from '../../../ui';
import { AiLabel } from '../../ai-label';
import {
  HUD_CORE,
  transcriptAtEnd,
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
/** A scroll event at most every frame: enough to know whether the end is in view. */
const SCROLL_THROTTLE_MS = 16;

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

/**
 * Follows the end: each content or size change scrolls to it while the person reads there; their own
 * scroll decides whether they still do. A new turn (the user's new words) follows again.
 */
function useFollowEnd(scroll: RefObject<ScrollView | null>, turnKey: string | null) {
  const following = useRef(true);
  useEffect(() => {
    following.current = true;
  }, [turnKey]);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    following.current = transcriptAtEnd(
      contentOffset.y,
      layoutMeasurement.height,
      contentSize.height,
    );
  }, []);
  const toEnd = useCallback(() => {
    if (following.current) scroll.current?.scrollToEnd({ animated: false });
  }, [scroll]);
  return { onScroll, toEnd };
}

export type TranscriptProps = { readonly turn: HudTurn };

export function Transcript({ turn }: TranscriptProps) {
  const core = useVoiceCore();
  const scroll = useRef<ScrollView>(null);
  const follow = useFollowEnd(scroll, turn.you);
  return (
    <ScrollView
      ref={scroll}
      style={styles.box}
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: transcript.padX, gap: transcript.gap },
      ]}
      onScroll={follow.onScroll}
      scrollEventThrottle={SCROLL_THROTTLE_MS}
      onContentSizeChange={follow.toEnd}
      onLayout={follow.toEnd}
    >
      <AiLabel agent={turn.agent} />
      <Hint turn={turn} core={core} />
      {transcriptRows(turn).map((row) => (
        <Row key={row.who} row={row} core={core} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
  /** Centred while it fits; taller, it starts at the top and scrolls. */
  content: { flexGrow: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  words: { flexShrink: 1 },
});
