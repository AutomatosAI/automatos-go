// Candy's avatar, pure (CANDY-LAYOUT §4 P1 and P4; the kit's agents/agent-card.tsx and
// agents.module.css at 3920359d5): a circle with a name's initial (sets.ts initialOf) in Outfit 600
// at 0.4 of the face (the frames' 22 on 66 with its rings, 16 on 40, 15 on 38). An active agent's
// face is its card gradient in the card ink; a resting one's the chip fill in quiet text. With a
// ring (Team's active row), a 3 pt ring — a sweep of the three cards' starts (the design's
// conic-gradient(g1a, g2a, g3a, g1a), from 12 o'clock) while active, the line colour while
// resting — then a 3 pt gap in the ground under it, then the face. Pure: no React, React Native,
// Expo or Skia.

import type { CandyVarName } from '../../tokens/candy';
import { CANDY_MIN } from '../../typeface/candy-type';

export type AvatarState = 'active' | 'resting';

/** The ring and the gap inside it, in points, and the initial's share of the face. */
export const AVATAR = Object.freeze({ ring: 3, gap: 3, initialShare: 0.4 });

/** The ring's sweep: the three cards' starts and back, evenly, turned so it starts at 12 o'clock. */
export const AVATAR_RING = Object.freeze({
  stops: Object.freeze(['g1a', 'g2a', 'g3a', 'g1a'] as const),
  positions: Object.freeze([0, 1 / 3, 2 / 3, 1]),
  /** Skia's sweep starts at 3 o'clock, CSS's conic at 12: a quarter turn back, in radians. */
  rotate: -Math.PI / 2,
});

export type AvatarMetrics = {
  /** The face's diameter inside the ring and the gap. */
  readonly face: number;
  readonly ring: number;
  readonly gap: number;
  /** The initial's size: 0.4 of the face, never under Candy's 12. */
  readonly initial: number;
};

export function avatarMetrics(size: number, ringed: boolean): AvatarMetrics {
  const ring = ringed ? AVATAR.ring : 0;
  const gap = ringed ? AVATAR.gap : 0;
  const face = Math.max(0, size - (ring + gap) * 2);
  return Object.freeze({
    face,
    ring,
    gap,
    initial: Math.max(CANDY_MIN, Math.round(face * AVATAR.initialShare)),
  });
}

/** What an avatar paints, as the palette's variable names: a gradient face or the chip's. */
export type AvatarPaint = {
  /** The face is its card gradient (active); else the `face` fill. */
  readonly gradient: boolean;
  readonly face: CandyVarName;
  readonly ink: CandyVarName;
  /** The ring: a sweep of these stops (active), else none and the `ringFill` colour. */
  readonly sweep: readonly CandyVarName[] | null;
  readonly ringFill: CandyVarName;
};

export function avatarPaint(state: AvatarState): AvatarPaint {
  if (state === 'active') {
    return Object.freeze({
      gradient: true,
      face: 'chip',
      ink: 'cardInk',
      sweep: AVATAR_RING.stops,
      ringFill: 'line',
    });
  }
  return Object.freeze({ gradient: false, face: 'chip', ink: 'quiet', sweep: null, ringFill: 'line' });
}
