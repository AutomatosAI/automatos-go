// The orb, pure (CANDY-LAYOUT §4 P1; the kit's art/orb.tsx and orb.module.css at 3920359d5): its
// side, the arc's turn and how far its ring reaches past the ball. The ball is the given size (200
// on Today) and grows with Dynamic Type so its figure and caption keep their room, never past the
// width it is given (the D-pad's lesson, A8 P001A-RVW-2), and never under the size. The white arc
// turns once every 20 s, linearly, on Candy's one clock (auto/clock.ts) while Candy moves; still,
// it rests where orb.module.css draws it (turned −20°, tokens/candy-paint.ts ORB_ARC). Pure: no
// React, React Native, Expo or Skia.

import type { ArcPaint, OrbPaint } from '../../tokens/candy-paint';

/** Today's orb, the arc's one turn (orb.module.css orb-turn 20s linear) and the caption (Nunito 800 14). */
export const ORB = Object.freeze({ size: 200, turnMs: 20000, caption: 14 });

/** The figure and caption sit in the ball's middle, at most this share of its width. */
export const ORB_WORDS_SHARE = 0.72;

/** The shadow under the white words (P1: 0 2 12, SHARED_COLOURS.figureShadow). */
export const ORB_WORDS_SHADOW = Object.freeze({ offsetY: 2, radius: 12 });

/** The page's gutters on the phone (the README's 20): the room an orb may grow to is the screen less these. */
export const PAGE_GUTTER = 20;

const FULL_TURN = 360;

/** How far the arc has turned at `ms` on the clock, in degrees (0 to 360, clockwise). */
export function orbTurnAt(ms: number): number {
  const t = Math.max(0, Number.isFinite(ms) ? ms : 0) % ORB.turnMs;
  return (t / ORB.turnMs) * FULL_TURN;
}

/** The arc turned on by `degrees` from where it rests. */
export function turnedArc(arc: ArcPaint, degrees: number): ArcPaint {
  return Object.freeze({ ...arc, start: arc.start + degrees });
}

/**
 * The ball's side: `size`, grown by the phone's text size, never past `room` (the width the orb
 * may take) and never under `size`. Without a usable room, the grown side.
 */
export function orbSide(size: number, fontScale: number, room: number): number {
  const scale = Number.isFinite(fontScale) && fontScale > 1 ? fontScale : 1;
  const grown = Math.round(size * scale);
  const cap = Number.isFinite(room) ? Math.floor(room) : grown;
  return Math.max(size, Math.min(grown, cap));
}

/** How far the ring round the ball reaches past its square on every side, in whole points. */
export function orbReach(paint: OrbPaint, side: number): number {
  return Math.ceil(paint.halo.r + paint.halo.strokeWidth / 2 - side / 2);
}
