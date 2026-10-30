// Auto's twelve states as Arcade animates them (PRD-001 §4.6.1, D-ARC-5; the design's README "Mascot:
// Auto as a sprite"): each a short stepped loop of two to four poses, and a still, which is the
// first pose. The names are the app's vendored mascot state names (core/frozen/lib/mascot/types.ts
// MASCOT_STATES, the web's @automatos/mascot), so the vendored reducer that follows the chat picks
// one of these. Every frame is drawn once, when the module loads. Pure: no React, React Native,
// Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/arcade/src/art/states.ts at 034fa629c
// (034fa629c8ba79cff042559ca2d132f6d38f6d23), sha256
// 3ca3955106f05acfdb30662856bf6b7ffc3c001255907c25104efd190ac27d5a. The poses are copied, never
// retuned: a change starts there. Only the layout and the import paths are the repo's.

import { MASCOT_STATES, type MascotName } from '../../../core/frozen/lib/mascot/types';
import type { SpriteKey } from '../../tokens/arcade-catalogue';
import { drawAuto, type Pose } from './auto-sprite';
import { runsOf, type Run } from './grid';

/** One frame: the runs of same-coloured pixels a renderer draws, one rect each. */
export type SpriteFrame = readonly Run<SpriteKey>[];

export interface SpriteState {
  readonly name: MascotName;
  /** What the state shows, in words: the Sprite gallery's note under it. */
  readonly note: string;
  readonly frames: readonly SpriteFrame[];
}

type Poses = { readonly note: string; readonly poses: readonly Pose[] };

const POSES: Readonly<Record<MascotName, Poses>> = {
  hello: {
    note: 'waves',
    poses: [
      { arms: 'wave1', eyes: 'happy' },
      { arms: 'wave2', eyes: 'happy', dy: -1 },
    ],
  },
  idle: { note: 'hovers, blinks', poses: [{}, { dy: 1 }, {}, { dy: 1, eyes: 'blink' }] },
  listening: {
    note: 'leans in',
    poses: [
      { eyes: 'wide', dx: 1 },
      { eyes: 'wide', dx: 1, dy: 1 },
    ],
  },
  thinking: {
    note: 'a "…" bubble',
    poses: [
      { eyes: 'up', fx: 'dots1' },
      { eyes: 'up', fx: 'dots2' },
      { eyes: 'up', fx: 'dots3' },
    ],
  },
  working: {
    note: 'taps busily',
    poses: [
      { eyes: 'narrow', arms: 'tap1' },
      { eyes: 'narrow', arms: 'tap2', dy: 1 },
      { eyes: 'narrow', arms: 'tap1' },
      { eyes: 'narrow', arms: 'tap2', dy: 1, fx: 'spark' },
    ],
  },
  searching: {
    note: 'eyes sweep',
    poses: [{ eyes: 'left', dx: -1 }, { eyes: 'open' }, { eyes: 'right', dx: 1 }, { eyes: 'open' }],
  },
  reading: {
    note: 'a page on the visor',
    poses: [{ eyes: 'page0' }, { eyes: 'page1' }, { eyes: 'page2' }],
  },
  celebrate: {
    note: 'jumps, sparkles',
    poses: [
      { arms: 'up', eyes: 'happy', fx: 'sp1' },
      { arms: 'up', eyes: 'happy', dy: -2, fx: 'sp2' },
      { arms: 'up', eyes: 'happy', dy: -4, fx: 'sp1' },
      { arms: 'up', eyes: 'happy', dy: -2, fx: 'sp2' },
    ],
  },
  oops: {
    note: 'a stumble and a drop',
    poses: [
      { eyes: 'small', arms: 'out', fx: 'drop' },
      { eyes: 'small', arms: 'out', dx: 2, dy: 1, fx: 'drop' },
      { eyes: 'small', arms: 'out', dx: 1 },
    ],
  },
  sleeping: {
    note: 'a "z" rises',
    poses: [
      { eyes: 'line', fx: 'z1', dy: 1 },
      { eyes: 'line', fx: 'z2', dy: 1 },
      { eyes: 'line', fx: 'z3' },
    ],
  },
  lost: {
    note: 'a "?" above',
    poses: [
      { eyes: 'left', arms: 'out', fx: 'q0' },
      { eyes: 'right', arms: 'out', fx: 'q1' },
    ],
  },
  loading: {
    note: 'an orbiting light',
    poses: [{ fx: 'o0' }, { fx: 'o1' }, { fx: 'o2' }, { fx: 'o3' }],
  },
};

export const SPRITE_STATES: readonly SpriteState[] = MASCOT_STATES.map((name) => ({
  name,
  note: POSES[name].note,
  frames: POSES[name].poses.map((pose) => runsOf(drawAuto(pose))),
}));

const BY_NAME: ReadonlyMap<MascotName, SpriteState> = new Map(
  SPRITE_STATES.map((state) => [state.name, state]),
);

export function spriteState(name: MascotName): SpriteState {
  return BY_NAME.get(name) ?? SPRITE_STATES[0];
}

/** The state in plain capitals, as the dialogue window's state word says it. */
export function stateWord(name: MascotName): string {
  return name.toUpperCase();
}
