// "Auto is writing", pure (CANDY-LAYOUT §4 P2; the kit's chat/entries.tsx WritingChip and
// thread.module.css at 3920359d5): a 36 pt chip with three 7 pt dots in the three cards' starts and
// the words. While Candy moves, each dot bounces 4 pt over 1.2 s (candy-writing: up by 30 %, back by
// 60 %, at rest to the end, each step ease-in-out), the second 0.15 s and the third 0.3 s behind
// the first, on Candy's one clock (auto/clock.ts); still, the dots rest and the words stay. Pure: no
// React, React Native, Expo or Skia.

import { CARD_START_VARS, type CandyVarName } from '../../tokens/candy';
import { easeInOut } from '../auto/clock';

/** The chip and its dots, in points, and the bounce's keyframes. */
export const WRITING = Object.freeze({
  height: 36,
  padH: 14,
  dot: 7,
  dotGap: 5,
  /** Between the dots and the words. */
  gap: 9,
  cycleMs: 1200,
  delayMs: 150,
  lift: 4,
  /** Where in the cycle the dot is highest, and back at rest. */
  peak: 0.3,
  rest: 0.6,
});

/** The dots' colours, left to right: the three cards' starts. */
export const WRITING_DOTS: readonly CandyVarName[] = Object.freeze([
  CARD_START_VARS[1],
  CARD_START_VARS[2],
  CARD_START_VARS[3],
]);

/** How far dot `index` (0, 1, 2) is lifted at `ms` on the clock: 0 at rest, −4 at the top. */
export function dotLiftAt(ms: number, index: number): number {
  const since = Math.max(0, (Number.isFinite(ms) ? ms : 0) - index * WRITING.delayMs);
  const progress = (since % WRITING.cycleMs) / WRITING.cycleMs;
  if (progress >= WRITING.rest) return 0;
  const up = progress < WRITING.peak;
  const step = up
    ? progress / WRITING.peak
    : (progress - WRITING.peak) / (WRITING.rest - WRITING.peak);
  const height = up ? easeInOut(step) : 1 - easeInOut(step);
  return height === 0 ? 0 : -WRITING.lift * height;
}
