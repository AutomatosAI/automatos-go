// HUD's waveform (D54, D-ONE-VOICE; the AC's Waveform.tsx, named WaveformView so './Waveform'
// never resolves to waveform.ts on a case-insensitive disk): waveform.ts's bars in the colour it is given, 3 pt apart and
// sharing the width. While loops run each bar breathes from its centre (scaleY 0.25 ↔ 1, its own
// time and delay, on reanimated); while they may not, every bar stands still at its full height.
// A6's live mic passes levels: each bar then stands at its level and the breath stops. Decoration,
// hidden from VoiceOver: the state chip and the mic say what it shows. Loops follow useVoiceCore
// (Arcade's pause stills the breath too, US-022i).

import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle } from 'react-native-reanimated';

import { CSS_EASE_IN_OUT } from './ring-specs';
import { useLoop } from './use-loop';
import { useVoiceCore } from './use-voice-core';
import { WAVE, levelScales, waveBars, type WaveBar } from './waveform';

const BREATH_EASING = Easing.bezier(...CSS_EASE_IN_OUT);
const [LEAST, MOST] = WAVE.scale;

type BarProps = {
  readonly bar: WaveBar;
  readonly colour: string;
  readonly loops: boolean;
  /** The live level's scaleY; null: the breath (or full height while still). */
  readonly level: number | null;
};

function Bar({ bar, colour, loops, level }: BarProps) {
  const breathing = loops && level === null;
  const progress = useLoop(breathing, bar.durationMs, {
    alternate: true,
    delayMs: bar.delayMs,
    easing: BREATH_EASING,
    rest: 1,
  });
  const breath = useAnimatedStyle(() => ({
    transform: [{ scaleY: level ?? LEAST + (MOST - LEAST) * progress.get() }],
  }));
  return (
    <Animated.View
      style={[
        styles.bar,
        { height: bar.height, backgroundColor: colour, opacity: bar.opacity },
        breath,
      ]}
    />
  );
}

export type WaveformProps = {
  /** The resolved accent: every bar is this colour at its own opacity. */
  readonly colour: string;
  /** A6's live mic, 0 to 1, oldest first; absent: the idle breath. */
  readonly levels?: readonly number[] | null;
  /** 44 bars 36 high on the phone. */
  readonly bars?: number;
  readonly height?: number;
};

export function Waveform({
  colour,
  levels,
  bars = WAVE.phone.bars,
  height = WAVE.phone.height,
}: WaveformProps) {
  const { loops } = useVoiceCore();
  const scales = levelScales(levels, bars);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.row, { height, gap: WAVE.gap }]}
    >
      {waveBars(bars, height).map((bar) => (
        <Bar
          key={bar.index}
          bar={bar}
          colour={colour}
          loops={loops}
          level={scales ? (scales[bar.index] ?? null) : null}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  bar: { flex: 1 },
});
