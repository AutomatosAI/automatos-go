// A filter pill's count, pure (docs/app-standard.md rule 10.5): the number beside the label, which
// a person reads, so it is a colour the contrast test can measure, never an opacity on the text.
// It is the pill's own ink at three quarters, as it has always looked, blended over the ground the
// pill shows (its fill, or its pressed fill while a finger is on it, over the page the pill sits
// on; a pill with no fill shows the page). Where that reads under AA on the ground, the count takes
// the ink itself, as the label does.

import { AA_TEXT, contrastRatio, mixHex } from '../core/web/lib/look-kit/contrast';
import { solidOver } from '../styles/contrast';
import type { Dress } from '../styles/dress/dress';

/** How much of the pill's ink the count is drawn in: a step quieter than its label. */
export const PILL_COUNT_ALPHA = 0.75;

/** The pill the count sits in: chosen or not, and pressed (a chosen pill draws no press). */
export type PillCountState = Readonly<{ selected: boolean; pressed?: boolean }>;

export type PillCount = Readonly<{
  /** The count's colour, solid. */
  colour: string;
  /** The ground it is read on: the pill's fill over the page. */
  ground: string;
}>;

/** The count of a pill drawn over `page` (the board's filters sit on the page). */
export function pillCount(dress: Dress, state: PillCountState, page: string): PillCount {
  const { pill } = dress.paints;
  const paint = state.selected ? pill.selected : pill.rest;
  const pressed = Boolean(state.pressed) && !state.selected;
  const ground = solidOver(pressed ? pill.pressed.background : paint.background, page);
  // the label keeps the pill's ink while it is pressed, and so does the count
  const ink = solidOver(paint.foreground, ground);
  const quiet = mixHex(ground, ink, PILL_COUNT_ALPHA);
  const colour = [quiet, ink].find((each) => contrastRatio(each, ground) >= AA_TEXT) ?? ink;
  return Object.freeze({ colour, ground });
}
