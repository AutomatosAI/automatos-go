// Candy's pause, pure (PRD-001 §4.6.2, D-CAN-5, D-A11Y; WCAG 2.2.2: anything that moves, blinks or
// loops for more than five seconds can be paused). The kit's motion/use-motion.ts and
// pause-toggle.tsx at 3920359d5, on the phone: Candy moves (Auto floats and blinks, the orb's ring
// turns, the writing dots bounce, the voice core) only while the style's loops may run (no Reduce
// Motion), the look's Motion is 'on' and the person has not paused it. Two different things stop it:
// the look's Motion knob, synced with the look and set on Make it sweet (US-023m), and this pause,
// the phone's own, never synced, set by CandyPauseButton. The choice lives in the app's encrypted
// MMKV store under 'styles.candy.motionPaused' beside Candy's looks, parsed and saved as Arcade's
// (arcade/motion-pause.ts keyedMotionPause) and held by the style store (provider/store.ts) so
// every moving part reads the one value. Under Reduce Motion nothing moves, and while the look's
// Motion is 'paused' nothing moves either, so there is no control (the kit's rule). Pure over the
// KeyValueStorage port: no React, React Native, Expo or Skia.

import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { keyedMotionPause, type MotionPauseSource } from '../arcade/motion-pause';
import { CANDY_PAUSE_COPY } from './strings';

/** The MMKV key (beside styles.candy.looks). */
export const CANDY_MOTION_PAUSED_KEY = 'styles.candy.motionPaused';

const CANDY_PAUSE = keyedMotionPause(CANDY_MOTION_PAUSED_KEY, "Candy's pause");

export function readCandyMotionPaused(storage: KeyValueStorage): boolean {
  return CANDY_PAUSE.read(storage);
}

/** true when the choice was saved; false (logged) when the store refused it. */
export function saveCandyMotionPaused(storage: KeyValueStorage, paused: boolean): boolean {
  return CANDY_PAUSE.save(storage, paused);
}

/** Candy's choice over one store, opened on the first read or write (as the looks stores are). */
export function createCandyMotionPauseSource(storage: () => KeyValueStorage): MotionPauseSource {
  return CANDY_PAUSE.source(storage);
}

/** What decides whether Candy moves. */
export type CandyMotionInput = {
  /** The style's loops may run (useStyle().motion.loops). */
  readonly loops: boolean;
  /** The phone's Reduce Motion is on (useStyle().motion.reason 'reduce-motion'). */
  readonly reduceMotion: boolean;
  /** The person paused the animation (the style store's candyMotionPaused). */
  readonly paused: boolean;
  /** The look's Motion knob is 'paused'. */
  readonly lookPaused: boolean;
};

/** Whether Candy moves, and why not. */
export type CandyMotionState = {
  /** Auto floats and blinks, and every other Candy loop runs. */
  readonly moving: boolean;
  /** The person paused the animation (kept while something else stills it, for when that ends). */
  readonly paused: boolean;
  /** Reduce Motion, or loops off for another style's reason: nothing moves, no control. */
  readonly reduced: boolean;
  /** The look's Motion is 'paused': nothing moves, no control (Make it sweet turns it back on). */
  readonly lookPaused: boolean;
};

/** Candy moves only while the loops may run, the look's Motion is on and nobody paused it. */
export function candyMotion(input: CandyMotionInput): CandyMotionState {
  const { loops, reduceMotion, paused, lookPaused } = input;
  return Object.freeze({
    moving: loops && !paused && !lookPaused,
    paused,
    reduced: reduceMotion || (!loops && !lookPaused),
    lookPaused,
  });
}

/** The control as drawn: its word and what VoiceOver hears (the action a tap takes). */
export type CandyPauseControl = {
  readonly word: string;
  readonly label: string;
  readonly paused: boolean;
};

/** Pause while moving, Play while paused; none under Reduce Motion or the look's Motion 'paused'. */
export function candyPauseControlOf(motion: CandyMotionState): CandyPauseControl | null {
  if (motion.reduced || motion.lookPaused) return null;
  const { pause, play, pauseLabel, playLabel } = CANDY_PAUSE_COPY;
  return Object.freeze({
    word: motion.paused ? play : pause,
    label: motion.paused ? playLabel : pauseLabel,
    paused: motion.paused,
  });
}
