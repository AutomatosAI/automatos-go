// The round arcade surround the voice button sits in (README 'Pages'; the design kit's
// frame/controls.tsx and handheld.module.css .surround; the 'Phone 390' controls): a 132 pt disc on
// the bar's ground inside a 4 pt ring in the window border, a 4 pt accent ring at 104 pt, and a
// hard drop shadow 6 pt down and right; the VOICE word under it. The button is passed in and placed
// at the centre as the home draws it; the surround is drawn behind it, never clips it, and takes no
// touch, so the button's own caption and Stop show uncovered. The surround and the word are
// decoration VoiceOver skips: the button says what it does.

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../../ui';
import { ARCADE_COPY } from '../../strings';
import { useArcadePaint } from './use-arcade-paint';

/** handheld.module.css .surroundRing and the design's phone: diameters and rings in points. */
export const SURROUND = Object.freeze({
  disc: 132,
  ring: 4,
  accent: 104,
  accentRing: 4,
  drop: 6,
  /** Between the surround and the VOICE word. */
  wordGap: 10,
});

const OUTER = SURROUND.disc + SURROUND.ring * 2;

export type VoiceSurroundProps = {
  /** The voice button, centred in the surround. */
  readonly children: ReactNode;
};

function Surround() {
  const { vars } = useArcadePaint();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <View style={[styles.disc, styles.shadow, { backgroundColor: vars.sh }]} />
      <View style={[styles.disc, { backgroundColor: vars.bar, borderColor: vars.bd }]}>
        <View style={[styles.accent, { borderColor: vars.ac }]} />
      </View>
    </View>
  );
}

export function VoiceSurround({ children }: VoiceSurroundProps) {
  const { vars, type } = useArcadePaint();
  return (
    <View style={styles.voice}>
      <View style={styles.box}>
        <Surround />
        <View pointerEvents="box-none" style={styles.slot}>
          {children}
        </View>
      </View>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[type.label, { color: vars.tx2 }]}
      >
        {ARCADE_COPY.voice}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  voice: { alignItems: 'center', gap: SURROUND.wordGap },
  box: { width: OUTER + SURROUND.drop, height: OUTER + SURROUND.drop },
  disc: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: OUTER,
    height: OUTER,
    borderRadius: OUTER / 2,
    borderWidth: SURROUND.ring,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: { top: SURROUND.drop, left: SURROUND.drop, borderWidth: 0 },
  accent: {
    width: SURROUND.accent,
    height: SURROUND.accent,
    borderRadius: SURROUND.accent / 2,
    borderWidth: SURROUND.accentRing,
  },
  slot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: OUTER,
    height: OUTER,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
