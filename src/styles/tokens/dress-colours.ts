// The colours the dress (src/styles/dress) derives from Play's and HUD's variables beyond the ones
// they carry, built with the vendored rgba as tokens/hud.ts builds its own, so every colour the
// shared primitives paint comes from this directory (D-TOKENS). Play: Ember's outline button, a 1
// pt line of the ground's text at 24 %, and 04's filter chips at 20 %. HUD: the soft accent glow
// round a selected or live panel ('Automatos Command Pages.dc.html': 0 0 24px -6px at .5). Arcade:
// a selected row or choice in the palette's highlight with its ink (the kit's looks.module.css
// '.radio:checked + .choiceFace': --arcade-hl under --arcade-hlt), a pair the kit holds at AA.
// Candy: a selected row or choice in the palette's accent with its ink (the kit's looks.module.css
// '.hiddenInput:checked + .segmentFace'), a pair the kit holds at AA too; and the tinted shadow
// under a window or card as one colour, the palette's tint at the look's glow (tokens/candy.ts
// candyShadow).

import { rgba } from '../../core/web/lib/look-kit/css';
import type { ArcadeVars } from './arcade';
import type { CandyShadow, CandyVars } from './candy';
import type { PlayVars } from './play';

/** Ember's outline button: a 1 pt line of the ground's text at 24 %. */
export const PLAY_OUTLINE_ALPHA = 0.24;
/** Ember 04's filter chips when not chosen: a 1 pt line of the ground's text at 20 %. */
export const PLAY_CHIP_LINE_ALPHA = 0.2;
/** HUD's soft accent glow round a selected panel. */
export const HUD_SELECTED_GLOW = Object.freeze({ blurRadius: 24, spreadDistance: -6, alpha: 0.5 });

export type PlayDressLines = { readonly outline: string; readonly chip: string };

/** Play's two lines of the ground's text: the outline button's and an unchosen chip's. */
export function playDressLines(vars: Pick<PlayVars, 'groundText'>): PlayDressLines {
  return Object.freeze({
    outline: rgba(vars.groundText, PLAY_OUTLINE_ALPHA),
    chip: rgba(vars.groundText, PLAY_CHIP_LINE_ALPHA),
  });
}

export type ArcadeSelectedColours = { readonly fill: string; readonly ink: string };

/** Arcade's selected row or choice: the highlight, and the text on it. */
export function arcadeSelectedColours(vars: Pick<ArcadeVars, 'hl' | 'hlt'>): ArcadeSelectedColours {
  return Object.freeze({ fill: vars.hl, ink: vars.hlt });
}

export type CandySelectedColours = { readonly fill: string; readonly ink: string };

/** Candy's selected row or choice: the accent, and the text on it. */
export function candySelectedColours(
  vars: Pick<CandyVars, 'accent' | 'accentInk'>,
): CandySelectedColours {
  return Object.freeze({ fill: vars.accent, ink: vars.accentInk });
}

/** Candy's shadow as a boxShadow colour: its tint at its opacity (the Glow knob's alpha). */
export function candyShadowColour(
  shadow: Pick<CandyShadow, 'shadowColor' | 'shadowOpacity'>,
): string {
  return rgba(shadow.shadowColor, shadow.shadowOpacity);
}

/** The colour of HUD's glow round a selected panel, in the look's accent. */
export function hudSelectedGlowColour(accent: string): string {
  return rgba(accent, HUD_SELECTED_GLOW.alpha);
}
