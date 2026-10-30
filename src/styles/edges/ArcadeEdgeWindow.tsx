// Arcade's edge screens (US-022i, D-ARC-5; the design kit's edges/not-found.tsx, its 404 window):
// a screen's words in one Arcade window, Auto's sprite at its head in the screen's state (hello,
// sleeping, oops, lost) with that state in words under it (the animation's text twin, as the
// dialogue's portrait says it), then the words. A tab, when given, names the screen with a glyph
// and a word ('— NOT ANSWERING', '✕ SNAG'), VoiceOver hearing the word alone. The sprite steps on
// Arcade's clock and holds frame 1 under Reduce Motion or the pause (PixelSprite); the window's
// scanlines sit behind its content. The bundled mascot never shows in Arcade (its style shows none).
// The pause control sits at the window's top end (P001A-RVW-1, WCAG 2.2.2): the sprite loops for
// as long as the screen shows, and these screens sit outside the handheld's status bar.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MascotName } from '../../core/frozen/lib/mascot/types';
import { Text } from '../../ui';
import { PauseButton } from '../arcade/PauseButton';
import { ArcadeWindow } from '../arcade/parts/ArcadeWindow';
import { portraitWords } from '../arcade/parts/dialogue';
import { useArcadePaint } from '../arcade/parts/use-arcade-paint';
import { PixelSprite } from '../arcade/sprite/PixelSprite';
import { EDGE_METRICS } from './metrics';

const { arcade } = EDGE_METRICS;

function EdgeSprite({ state }: { readonly state: MascotName }) {
  const { vars, type } = useArcadePaint();
  const words = portraitWords(state);
  return (
    <View style={[styles.sprite, { gap: arcade.spriteGap }]}>
      <PixelSprite state={state} />
      <Text accessibilityLabel={words.label} style={[type.display('status'), { color: vars.tx2 }]}>
        {words.word}
      </Text>
    </View>
  );
}

export type ArcadeEdgeWindowProps = {
  /** Auto's state on this screen. */
  readonly state: MascotName;
  /** The tab: a glyph and a word ('— Not answering'); none when omitted. */
  readonly title?: string;
  /** What VoiceOver hears for the tab: the word alone. */
  readonly titleLabel?: string;
  /** The words centred under Auto (First open, Lost); along the start otherwise. */
  readonly centred?: boolean;
  readonly children: ReactNode;
};

export function ArcadeEdgeWindow(props: ArcadeEdgeWindowProps) {
  const { state, title, titleLabel, centred = false, children } = props;
  return (
    <ArcadeWindow
      title={title}
      titleLabel={titleLabel}
      style={styles.window}
      contentStyle={[styles.content, centred ? styles.centred : null]}
    >
      <View style={styles.pause}>
        <PauseButton />
      </View>
      <EdgeSprite state={state} />
      {children}
    </ArcadeWindow>
  );
}

const styles = StyleSheet.create({
  window: { alignSelf: 'stretch' },
  content: { padding: arcade.pad, gap: arcade.gap },
  centred: { alignItems: 'center' },
  pause: { alignSelf: 'flex-end' },
  sprite: { alignSelf: 'center', alignItems: 'center' },
});
