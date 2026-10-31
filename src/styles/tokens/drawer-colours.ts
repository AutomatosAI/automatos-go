// What HUD's Looks drawer draws beyond hudVars ('Automatos Command HUD.dc.html'): the edge around a
// Background swatch, white at 25 % so each ground's square shows on the drawer, and the glow
// around a look card's accent ring (the drawing's box-shadow 0 0 12px and inset 0 0 8px in the
// accent). Arcade's Options choices (the kit's looks.module.css '.choiceFace'): the page inside a
// 2 pt ring of the window border, the text, the chosen one in the highlight with its ink, and the
// focus outline in the accent. Candy's Make it sweet (the kit's looks.module.css '.segmented',
// '.segmentFace' and '.swatchFace'): the chip as a row's track, the text, the chosen one in the
// accent with its ink, a chosen palette's circle ringed in the accent past a gap of the window, and
// the focus outline in the accent's text colour. Here, beside the other derived colours, so no
// colour is written elsewhere (D-TOKENS).

import type { ArcadeVars } from './arcade';
import type { CandyVars } from './candy';

/** The drawing's rgba(255,255,255,.25). */
export const HUD_SWATCH_EDGE = 'rgba(255,255,255,0.25)';

/** A ring's glow outside and inside in its own colour, as React Native's boxShadow takes it. */
export function ringGlow(colour: string, outer: number, inner: number): string {
  return `0 0 ${outer}px ${colour}, inset 0 0 ${inner}px ${colour}`;
}

export type ArcadeChoiceColours = {
  readonly face: string;
  readonly ring: string;
  readonly text: string;
  readonly chosenFace: string;
  readonly chosenText: string;
  readonly focus: string;
};

/** One choice on Arcade's Options page, as the kit paints it. */
export function arcadeChoiceColours(
  vars: Pick<ArcadeVars, 'page' | 'bd' | 'tx' | 'hl' | 'hlt' | 'ac'>,
): ArcadeChoiceColours {
  return Object.freeze({
    face: vars.page,
    ring: vars.bd,
    text: vars.tx,
    chosenFace: vars.hl,
    chosenText: vars.hlt,
    focus: vars.ac,
  });
}

export type CandyChoiceColours = {
  readonly track: string;
  readonly text: string;
  readonly chosenFace: string;
  readonly chosenText: string;
  /** A chosen palette circle: the gap round it, then the ring. */
  readonly gap: string;
  readonly ring: string;
  readonly focus: string;
};

/** One choice on Candy's Make it sweet, as the kit paints it. */
export function candyChoiceColours(
  vars: Pick<CandyVars, 'chip' | 'text' | 'accent' | 'accentInk' | 'win' | 'accentText'>,
): CandyChoiceColours {
  return Object.freeze({
    track: vars.chip,
    text: vars.text,
    chosenFace: vars.accent,
    chosenText: vars.accentInk,
    gap: vars.win,
    ring: vars.accent,
    focus: vars.accentText,
  });
}
