// The dialogue window (README 'Pages' and 'Motion'; the design kit's chat/dialogue.tsx and the
// 'Phone 390' dialogue box): a window tabbed AUTO, Auto's portrait (PixelSprite at 2×, on the page
// ground inside the window border) with his state word under it, and his newest reply typing out
// at the look's text speed on Arcade's clock, with the ▼ cursor and Skip while it types (dialogue.ts
// decides each). Reduce Motion and the pause control show the reply whole and hold the cursor on.
// VoiceOver never hears the typing: the line is hidden while it types, then reads as the whole
// reply, which is said once (iOS ignores live regions, so it is announced). A reply that was
// already there when the chat opened shows whole and is not said again. Below the words, the home
// places its own controls (`children`: TYPE, the composer) on the window. The line scrolls past
// 22 % of the screen's height; when the window is too narrow for words beside a large portrait,
// the words wrap under it.

import { useEffect, useRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import type { MascotName } from '../../../core/frozen/lib/mascot/types';
import { Text } from '../../../ui';
import { ARCADE_COPY } from '../../strings';
import { ARCADE_DIALOGUE } from '../../typeface/arcade-type';
import { PixelSprite } from '../sprite/PixelSprite';
import { useCursorOn } from '../sprite/use-ticks';
import { useArcadeMotion } from '../use-arcade-motion';
import { useTypewriter } from '../use-typewriter';
import { ArcadeButton } from './ArcadeButton';
import { ArcadeWindow } from './ArcadeWindow';
import { dialogueView, portraitWords, type DialogueReply, type DialogueView } from './dialogue';
import { useArcadePaint } from './use-arcade-paint';

/** The phone's dialogue (dialogue.module.css [data-layout=phone]): padding, gaps, the line's room. */
const DIALOGUE = Object.freeze({
  pad: 10,
  gap: 8,
  bodyGap: 10,
  portraitPad: 4,
  portraitRing: 2,
  /** The words keep this much width beside the portrait, or wrap under it. */
  sayMin: 160,
  /** The line's least height in lines, and its most as a share of the screen (22vh). */
  minLines: 3,
  maxShare: 0.22,
});

function Portrait({ state }: { readonly state: MascotName }) {
  const { vars, type } = useArcadePaint();
  const words = portraitWords(state);
  return (
    <View style={styles.portrait}>
      <View style={[styles.portraitBox, { backgroundColor: vars.page, borderColor: vars.bd }]}>
        <PixelSprite state={state} view="portrait" />
      </View>
      <Text accessibilityLabel={words.label} style={[type.display('status'), { color: vars.tx2 }]}>
        {words.word}
      </Text>
    </View>
  );
}

/** The finished reply, said once by its id (iOS; Android hears the live region). */
function useAnnounceOnce(id: string | null, text: string, ready: boolean) {
  const said = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || said.current === id) return;
    said.current = id;
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
  }, [id, text, ready]);
}

function Line({ view }: { readonly view: DialogueView }) {
  const { vars, type } = useArcadePaint();
  // on (and not listening to the clock) while the line types or Arcade is still
  const cursorOn = useCursorOn(view.blinking);
  const lineStyle = type.body(ARCADE_DIALOGUE.size);
  const minHeight = lineStyle.lineHeight * DIALOGUE.minLines;
  return (
    <Text
      accessibilityElementsHidden={view.hidden}
      importantForAccessibility={view.hidden ? 'no-hide-descendants' : 'auto'}
      accessibilityLabel={view.label}
      accessibilityLiveRegion={view.announce ? 'polite' : 'none'}
      style={[lineStyle, { color: vars.tx, minHeight }]}
    >
      {view.words}
      {view.cursor ? (
        <Text style={[type.label, { color: vars.ac, opacity: cursorOn ? 1 : 0 }]}>
          {` ${ARCADE_COPY.dialogue.cursor}`}
        </Text>
      ) : null}
    </Text>
  );
}

export type DialogueWindowProps = {
  /** Auto's state for the portrait (turn-state.ts portraitState). */
  readonly state: MascotName;
  /** His newest reply, in plain words. */
  readonly reply: DialogueReply;
  /** Waiting on Auto: '…' instead of the reply. */
  readonly thinking?: boolean;
  /** The home's controls under the words (TYPE, the composer). */
  readonly children?: ReactNode;
};

export function DialogueWindow({ state, reply, thinking = false, children }: DialogueWindowProps) {
  const { look } = useArcadePaint();
  const { moving } = useArcadeMotion();
  const { height } = useWindowDimensions();
  const typed = useTypewriter(reply.id, reply.text, {
    speed: look.textSpeed,
    moving,
    streaming: reply.streaming,
    whole: reply.whole,
  });
  const view = dialogueView(reply, typed, thinking, moving);
  useAnnounceOnce(reply.id, reply.text, view.announce);
  return (
    <ArcadeWindow title={ARCADE_COPY.dialogue.speaker} contentStyle={styles.content}>
      <View style={styles.body}>
        <Portrait state={state} />
        <View style={styles.say}>
          <ScrollView style={{ maxHeight: height * DIALOGUE.maxShare }}>
            <Line view={view} />
          </ScrollView>
          {view.skip ? (
            <ArcadeButton
              label={ARCADE_COPY.dialogue.skip}
              hint={ARCADE_COPY.dialogue.skipHint}
              onPress={typed.skip}
            />
          ) : null}
        </View>
      </View>
      {children}
    </ArcadeWindow>
  );
}

const styles = StyleSheet.create({
  content: { padding: DIALOGUE.pad, gap: DIALOGUE.gap },
  body: { flexDirection: 'row', flexWrap: 'wrap', gap: DIALOGUE.bodyGap },
  portrait: { alignItems: 'center', gap: DIALOGUE.bodyGap },
  portraitBox: { padding: DIALOGUE.portraitPad, borderWidth: DIALOGUE.portraitRing },
  say: { flexGrow: 1, flexBasis: DIALOGUE.sayMin, gap: DIALOGUE.bodyGap, alignItems: 'flex-start' },
});
