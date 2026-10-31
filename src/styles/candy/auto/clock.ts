// Candy's one clock (PRD-001 §4.6.2, D-CAN-5; CANDY-LAYOUT §6: "float 4px over 3s and blink every
// 4–6s, on one clock"): Auto's two loops as functions of time, so every drawing of him reads the
// same numbers and the tests pin both curves. The motion is the design kit's
// themes/candy/src/art/art.module.css at 3920359d5 (sha256
// 0023785fff2ea3f30bb8bb5287308831b58bf1902c5b473b7a56a04a758f047c):
//
//   float   3 s each way, ease-in-out, there and back (CSS alternate), up 3.5 of the drawing's
//           104 units (4 pt when he is drawn at 120 pt)
//   blink   the eyes open until 94 % of a period, shut to scaleY 0.1 at 97 % and open again by
//           100 %, each step ease-in-out; the web blinks every 5 s, the phone runs a fixed cycle of
//           periods inside 4–6 s (BLINK_PERIODS_MS)
//
// Its ticker is CANDY_CLOCK, one JS interval (arcade/sprite/clock.ts createTicker) shared by every
// Auto on screen: it runs only while something listens and stops when the last listener goes, and
// use-auto-motion.ts listens only while he moves, so nothing ticks while no Auto is mounted or
// every one is still. Pure: no React, React Native, Expo or Skia.

import { createTicker, type Ticker } from '../../arcade/sprite/clock';

/** One way of the float, in milliseconds (up for 3 s, down for 3 s). */
export const FLOAT_MS = 3000;
/** How far he rises, in the drawing's units (AUTO_BOX.size 104). */
export const FLOAT_UNITS = 3.5;

/** The blink's periods in turn, each inside 4–6 s, then round again (the web's is one 5 s). */
export const BLINK_PERIODS_MS: readonly number[] = Object.freeze([5000, 4200, 5800, 4600, 5400]);
/** Where in a period the eyes start to close, are shut, and are open again (the keyframes). */
export const BLINK_CLOSES = 0.94;
export const BLINK_SHUT = 0.97;
/** The eyes' height when shut (scaleY). */
export const BLINK_SCALE = 0.1;

/** The clock's step: about 30 frames a second. */
export const FRAME_MS = 33;

/** What the loops do to him at a moment: the float (box units, up is negative) and the eyes' scale. */
export type AutoMotion = {
  readonly floatY: number;
  readonly eyeScale: number;
};

/** Auto still: at rest, eyes open (Reduce Motion, the look's Motion paused, the pause, a still). */
export const STILL_MOTION: AutoMotion = Object.freeze({ floatY: 0, eyeScale: 1 });

/** CSS's ease-in-out: cubic-bezier(0.42, 0, 0.58, 1). */
const EASE_X1 = 0.42;
const EASE_X2 = 0.58;
const EASE_STEPS = 40;

/** One coordinate of a cubic Bézier from (0, 0) to (1, 1) with control values a and b, at t. */
function bezier(t: number, a: number, b: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

/** CSS's ease-in-out at x (0–1): the curve's t found by halving, then its y. */
export function easeInOut(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let low = 0;
  let high = 1;
  for (let step = 0; step < EASE_STEPS; step += 1) {
    const mid = (low + high) / 2;
    if (bezier(mid, EASE_X1, EASE_X2) < x) low = mid;
    else high = mid;
  }
  return bezier((low + high) / 2, 0, 1);
}

/** The float at `ms`: 0 at rest, -FLOAT_UNITS at the top, after FLOAT_MS, and back by twice that. */
export function floatAt(ms: number): number {
  const t = Math.max(0, ms) % (FLOAT_MS * 2);
  const progress = t < FLOAT_MS ? t / FLOAT_MS : (FLOAT_MS * 2 - t) / FLOAT_MS;
  return 0 - FLOAT_UNITS * easeInOut(progress);
}

const BLINK_CYCLE_MS = BLINK_PERIODS_MS.reduce((sum, period) => sum + period, 0);

/** Where `ms` falls in the blink's cycle: which period, and how far through it (0–1). */
export function blinkPhaseAt(ms: number): { readonly period: number; readonly progress: number } {
  let left = Math.max(0, ms) % BLINK_CYCLE_MS;
  for (let period = 0; period < BLINK_PERIODS_MS.length; period += 1) {
    const length = BLINK_PERIODS_MS[period] as number;
    if (left < length) return { period, progress: left / length };
    left -= length;
  }
  return { period: 0, progress: 0 };
}

/** The eyes' scaleY at `ms`: 1 until the period's last 6 %, BLINK_SCALE at 97 %, 1 again at its end. */
export function eyeScaleAt(ms: number): number {
  const { progress } = blinkPhaseAt(ms);
  if (progress < BLINK_CLOSES) return 1;
  const shut = 1 - BLINK_SCALE;
  if (progress < BLINK_SHUT) {
    return 1 - shut * easeInOut((progress - BLINK_CLOSES) / (BLINK_SHUT - BLINK_CLOSES));
  }
  return BLINK_SCALE + shut * easeInOut((progress - BLINK_SHUT) / (1 - BLINK_SHUT));
}

/** Both loops at `ms` on the one clock. */
export function motionAt(ms: number): AutoMotion {
  return Object.freeze({ floatY: floatAt(ms), eyeScale: eyeScaleAt(ms) });
}

/** The app's one Candy clock: every moving Auto reads it. */
export const CANDY_CLOCK: Ticker = createTicker(FRAME_MS);

/** A tick of CANDY_CLOCK as milliseconds of motion. */
export function clockMs(tick: number): number {
  return Math.max(0, tick) * FRAME_MS;
}
