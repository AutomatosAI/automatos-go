// Candy's edge screens (US-023l, CANDY-LAYOUT §7; the kit's edges/asleep.tsx and not-found.tsx at
// 3920359d5): a screen's words in one window — the palette's win with the look's r corners
// (nearestRadius, as the kit's .window takes --candy-r) on its tinted shadow — with the band across
// its top (Band, the band alone, clipped to the window's corners), Auto at 140 on it in the screen's
// state (hello, sleeping, oops, lost), named 'Auto, {what he is doing}', and his state as a glyph
// and a word under him (the text twin of his drawing, as the Chat view's state pill says it;
// VoiceOver hears the word), then the words. Small text sits under the band, on the window. Auto
// floats and blinks on Candy's one clock for as long as the screen shows (Not running can be
// reached before the home exists), so the pause control sits at the window's top end, filled
// (D-CAN-5, WCAG 2.2.2). The bundled mascot never shows in Candy (its style shows none).

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MascotName } from '../../core/frozen/lib/mascot/types';
import { Text } from '../../ui';
import { CandyAuto } from '../candy/auto/CandyAuto';
import { stateGlyph, stateWord } from '../candy/auto/state-words';
import { CandyPauseButton } from '../candy/CandyPauseButton';
import { statePill } from '../candy/home/chat';
import { Band } from '../candy/parts/Band';
import { BAND_CURVE } from '../candy/parts/shapes';
import { useCandyPaint } from '../candy/parts/use-candy-paint';
import { nearestRadius } from '../tokens/candy';
import { EDGE_METRICS } from './metrics';

const { candy } = EDGE_METRICS;

function EdgeAuto({ state }: { readonly state: MascotName }) {
  const { vars, type } = useCandyPaint();
  const pill = statePill({ glyph: stateGlyph(state), word: stateWord(state) });
  return (
    <View style={[styles.auto, { gap: candy.wordGap }]}>
      <CandyAuto state={state} size={candy.auto} />
      <Text accessibilityLabel={pill.label} style={[type.display('status'), { color: vars.quiet }]}>
        {pill.text}
      </Text>
    </View>
  );
}

export type CandyEdgeWindowProps = {
  /** Auto's state on this screen. */
  readonly state: MascotName;
  /** The words centred under Auto (First open, Lost); along the start otherwise. */
  readonly centred?: boolean;
  readonly children: ReactNode;
};

export function CandyEdgeWindow({ state, centred = false, children }: CandyEdgeWindowProps) {
  const { look, vars, shadow } = useCandyPaint();
  const corners = { borderRadius: nearestRadius(look.roundness) };
  return (
    <View style={[styles.window, corners, { backgroundColor: vars.win }, shadow]}>
      <View style={[styles.clip, corners]}>
        <Band height={candy.band} curve={BAND_CURVE.max} page={false} />
        <View style={[styles.content, centred ? styles.centred : null]}>
          <View style={styles.pause}>
            <CandyPauseButton />
          </View>
          <EdgeAuto state={state} />
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  window: { alignSelf: 'stretch' },
  clip: { overflow: 'hidden' },
  content: { padding: candy.pad, gap: candy.gap },
  centred: { alignItems: 'center' },
  pause: { alignSelf: 'flex-end' },
  auto: { alignSelf: 'center', alignItems: 'center' },
});
