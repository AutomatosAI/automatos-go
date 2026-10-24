// Play's messages (Ember 01-02 and the style sheet's 'message · yours outlined, Auto's unboxed'):
// the user's words in an outlined bubble on the right (radius 14, a 1 pt line of the ground's text
// at 0.16, 12 x 16 pad, at most 290 wide, Geist 15/1.5); Auto's unboxed in Geist 16/1.6, plain text
// as A2 draws it (KC5), with a 2 x 20 accent caret while the reply streams (lit and still under
// Reduce Motion). A new message rises 12 pt and fades in over 180 ms; history never replays (the
// caller says which are new) and Reduce Motion stills it. PlayThreadCaption is Play's thread's
// first row: the AI label, one muted caption that scrolls away with the thread (D73) — never a
// pill beside the composer. An Auto message may draw its words itself (`children`: A2's markdown,
// US-016k) in the thread's face; the caret still follows them.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '../../../ui';
import { AiLabel } from '../../ai-label';
import { useTokens } from '../../theme';
import { Blink } from './Loop';
import { COMPANION } from './model';
import { useCompanionPaint } from './use-companion';

const { bubble, caret, rise } = COMPANION;
/** The thread's 16/1.6 (Ember's Auto reply). */
const THREAD_SIZE = 16;

/** reanimated's FadeInDown starts 25 pt low; Ember's messages rise 12. */
const RISE = FadeInDown.duration(rise.durationMs).withInitialValues({
  transform: [{ translateY: rise.distance }],
});

type RiseProps = { readonly rise: boolean; readonly loops: boolean; readonly children: ReactNode };

function Rise({ rise: rises, loops, children }: RiseProps) {
  return <Animated.View entering={rises && loops ? RISE : undefined}>{children}</Animated.View>;
}

export type PlayMessageProps = {
  readonly text: string;
  /** A message that just arrived rises in; history passes false. */
  readonly rise?: boolean;
};

export function UserMessage({ text, rise: rises = false }: PlayMessageProps) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const { vars, lines, style } = paint;
  return (
    <Rise rise={rises} loops={paint.loops}>
      <View
        style={[
          styles.bubble,
          {
            maxWidth: bubble.maxWidth,
            paddingHorizontal: bubble.paddingX,
            paddingVertical: bubble.paddingY,
            borderRadius: style.radii.card,
            borderColor: lines.bubbleLine,
          },
        ]}
      >
        <Text selectable style={[style.type.body(bubble.size), { color: vars.groundText }]}>
          {text}
        </Text>
      </View>
    </Rise>
  );
}

export type AutoMessageProps = PlayMessageProps & {
  /** The reply is still being written: the caret follows the words. */
  readonly streaming?: boolean;
  /** The words drawn by the caller (A2's markdown) in place of `text` as plain text. */
  readonly children?: ReactNode;
};

export function AutoMessage({
  text,
  streaming = false,
  rise: rises = false,
  children,
}: AutoMessageProps) {
  const paint = useCompanionPaint();
  if (!paint) return null;
  const { vars, style } = paint;
  return (
    <Rise rise={rises} loops={paint.loops}>
      <View style={styles.reply}>
        {children ? (
          <View style={styles.words}>{children}</View>
        ) : (
          <Text
            selectable
            style={[style.type.body(THREAD_SIZE), styles.words, { color: vars.groundText }]}
          >
            {text}
          </Text>
        )}
        {streaming ? (
          <Blink
            animate={paint.loops}
            style={{ width: caret.width, height: caret.height, backgroundColor: vars.accent }}
          />
        ) : null}
      </View>
    </Rise>
  );
}

/** Play's thread opens with the AI label, centred, 16 pt above the first message (D73). */
export function PlayThreadCaption() {
  const { spacing } = useTokens();
  return (
    <View style={[styles.caption, { paddingBottom: spacing.space7 }]}>
      <AiLabel />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { alignSelf: 'flex-end', borderWidth: 1 },
  reply: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  words: { flexShrink: 1 },
  caption: { alignItems: 'center' },
});
