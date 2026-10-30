// The colours the style picker's stand-ins (src/styles/picker/stand-ins.ts, US-016h) derive beyond
// the ones a style carries, built with the vendored rgba as tokens/edge-colours.ts builds its own,
// so every colour the previews paint comes from this directory (D-TOKENS): Auto's ring glow (his
// light at 0.35, Mascot.dc.html), the clear far stop of Play's page glow (the accent at 0) and
// HUD's core() rings in the look's accent (the outer ring at 0.22, the dashed at 0.4, the disc at
// 0.28) and Arcade's small handheld (the page, a window in its border with the palette's shadow,
// a line of text and the accent's ▶ cursor).

import { rgba } from '../../core/web/lib/look-kit/css';
import type { ArcadeVars } from './arcade';

/** The previews' alphas, each named for what it paints. */
export const PREVIEW_ALPHAS = Object.freeze({
  /** Auto's ring glow: the ring's colour at 35 %. */
  autoRingGlow: 0.35,
  /** Where Play's page glow fades to: the accent at 0. */
  glowFade: 0,
  /** HUD's core: the outer 1 pt ring at 22 %. */
  coreOuter: 0.22,
  /** HUD's core: the dashed ring at 40 %. */
  coreDashed: 0.4,
  /** HUD's core: the pulse disc at 28 %. */
  coreDisc: 0.28,
});

/** Auto's ring glow for the ring's colour. */
export function autoRingGlow(ring: string): string {
  return rgba(ring, PREVIEW_ALPHAS.autoRingGlow);
}

/** The page glow's far stop: the accent, clear. */
export function glowFade(accent: string): string {
  return rgba(accent, PREVIEW_ALPHAS.glowFade);
}

export type CoreRingColours = {
  readonly outer: string;
  readonly dashed: string;
  readonly disc: string;
};

/** HUD's core rings in the look's accent (D-ONE-VOICE: the colour is the resolved style's). */
export function coreRingColours(accent: string): CoreRingColours {
  const a = PREVIEW_ALPHAS;
  return Object.freeze({
    outer: rgba(accent, a.coreOuter),
    dashed: rgba(accent, a.coreDashed),
    disc: rgba(accent, a.coreDisc),
  });
}

export type ArcadePreviewColours = {
  readonly screen: string;
  readonly window: string;
  readonly frame: string;
  readonly shadow: string;
  readonly text: string;
  readonly cursor: string;
};

/** Arcade's card in the picker, in the palette's own colours. */
export function arcadePreviewColours(
  vars: Pick<ArcadeVars, 'page' | 'win' | 'bd' | 'sh' | 'tx' | 'ac'>,
): ArcadePreviewColours {
  return Object.freeze({
    screen: vars.page,
    window: vars.win,
    frame: vars.bd,
    shadow: vars.sh,
    text: vars.tx,
    cursor: vars.ac,
  });
}
