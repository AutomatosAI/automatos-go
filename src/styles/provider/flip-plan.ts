// What a flip does (PRD-001 §4.6, D54, D-A11Y), pure so vitest can hold it; flip.ts plays it. A
// flip to the style already shown does nothing. Any other flip stores the choice, taps once
// (expo-haptics selection) and crossfades the whole app over FLIP_CROSSFADE_MS, or swaps at once
// under Reduce Motion; a flip that enters Play also has Auto say hello: the vendored reducer's
// 'app-open', once per flip (the store's playEntries).

import type { ClientEvent } from '../../core/frozen/lib/mascot/types';
import {
  layoutOf,
  paintedChoice,
  sameChoice,
  samePhoneChoice,
  type PhoneChoice,
  type StyleChoice,
} from '../registry/style-id';

/** The crossfade from the old style to the new one. */
export const FLIP_CROSSFADE_MS = 180;

/** What Auto is sent when a flip enters Play: his hello. */
export const FLIP_HELLO: ClientEvent = Object.freeze({ type: 'app-open' });

export type FlipPlan =
  | { readonly changed: false }
  | {
      readonly changed: true;
      readonly choice: StyleChoice;
      /** 0 under Reduce Motion: the new style at once. */
      readonly crossfadeMs: number;
      /** The flip enters Play from another layout. */
      readonly hello: boolean;
    };

const UNCHANGED: FlipPlan = Object.freeze({ changed: false });

export function flipPlan(from: StyleChoice, to: StyleChoice, reduceMotion: boolean): FlipPlan {
  if (sameChoice(from, to)) return UNCHANGED;
  return Object.freeze({
    changed: true,
    choice: to,
    crossfadeMs: reduceMotion ? 0 : FLIP_CROSSFADE_MS,
    hello: layoutOf(to) === 'play' && layoutOf(from) !== 'play',
  });
}

export type PhoneFlipPlan =
  | { readonly changed: false }
  | {
      readonly changed: true;
      readonly choice: PhoneChoice;
      /** 0 when the painted style stays (picking 'Same as Studio' while it paints the same). */
      readonly crossfadeMs: number;
      readonly hello: boolean;
    };

/**
 * A pick on the phone, 'Same as Studio' included (D-PHONE-CHOICE): any new choice is stored and
 * tapped; the crossfade and Auto's hello follow the style painted before and after, so picking
 * 'Same as Studio' while Studio already shows the same style changes nothing on screen.
 */
export function phoneFlipPlan(
  from: PhoneChoice,
  to: PhoneChoice,
  followed: StyleChoice,
  reduceMotion: boolean,
): PhoneFlipPlan {
  if (samePhoneChoice(from, to)) return UNCHANGED;
  const painted = flipPlan(
    paintedChoice(from, followed),
    paintedChoice(to, followed),
    reduceMotion,
  );
  return Object.freeze({
    changed: true,
    choice: to,
    crossfadeMs: painted.changed ? painted.crossfadeMs : 0,
    hello: painted.changed && painted.hello,
  });
}
