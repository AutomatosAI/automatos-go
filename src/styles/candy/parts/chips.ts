// Candy's pills and status chips, pure (CANDY-LAYOUT §4 P3 and P4, the README's 'Status'; the
// kit's ui/ui.module.css .pill and .chip at 3920359d5). A pill is a 36 pt capsule (999 corners) in
// the chip fill, or the window's on a ground of chips, and the accent with its ink while chosen; a
// row of them slides sideways. A status chip is always a glyph and a word, never colour alone: '●
// Working' on the chip fill in text while active, '○ Ready' in quiet text on nothing while resting;
// VoiceOver hears the word, never the glyph. Pure: no React, React Native, Expo or Skia.

import type { CandyVarName } from '../../tokens/candy';
import { CANDY_COPY } from '../strings';

/** The design's measures, in points: a pill and a status chip, their padding and glyph gap. */
export const PILL = Object.freeze({ height: 36, padH: 14, gap: 8 });
export const STATUS_CHIP = Object.freeze({ height: 26, padH: 10, gap: 4 });

/** A pill's ground while not chosen: the chip fill (the default) or the window's. */
export type PillGround = 'chip' | 'win';

export type ChipPaint = {
  readonly fill: CandyVarName | null;
  readonly ink: CandyVarName;
};

export function pillPaint(selected: boolean, ground: PillGround = 'chip'): ChipPaint {
  if (selected) return Object.freeze({ fill: 'accent', ink: 'accentInk' });
  return Object.freeze({ fill: ground, ink: 'text' });
}

export type StatusChipModel = ChipPaint & {
  readonly glyph: string;
  readonly word: string;
};

/** An active status ('● Working') on the chip fill; a resting one ('○ Ready') in quiet text. */
export function statusChipOf(active: boolean, word: string): StatusChipModel {
  const { statusGlyph } = CANDY_COPY;
  if (active) return Object.freeze({ glyph: statusGlyph.active, word, fill: 'chip', ink: 'text' });
  return Object.freeze({ glyph: statusGlyph.resting, word, fill: null, ink: 'quiet' });
}
