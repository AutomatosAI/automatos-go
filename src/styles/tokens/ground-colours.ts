// The colours the grounds (src/styles/ground) paint behind a screen, built with the vendored rgba,
// safeGlowAlpha and snagGlowAlpha as tokens/hud.ts builds its own, so every colour a ground paints
// comes from this directory (D-TOKENS). A light is two stops: its colour at the centre and the same
// colour at alpha 0 at the edge (Skia blends a gradient unpremultiplied, so a 'transparent' stop
// would grey the fade where CSS's premultiplied blend does not).
//
//   Play  Ember's 390 pt screens are drawn in Ember at its glow 24, so a screen's light is the
//         look's glow colour at the drawn alpha scaled by the look's glow over Ember's: Ember
//         paints each screen as drawn, a look with less glow paints less, and none ever past the
//         vendored safeGlowAlpha. Not running's dusk light is the ground's dusk as drawn; Something
//         went wrong's coral and the snag layer are the error, never past snagGlowAlpha (glowSnag).
//   HUD   its variables' glow (the accent at the capped glow) with the accent at 0 for the edge,
//         the grid and the README's scanline.
//   Arcade  the palette's page, flat (no glow, no grid), and the scanlines' colour, which Arcade
//         draws inside its windows only, behind their content: never a layer over the AI label.

import { GLOW_SCALE, rgba } from '../../core/web/lib/look-kit/css';
import { safeGlow, safeGlowAlpha, snagGlowAlpha } from '../../core/frozen/lib/looks/engine';
import { EMBER } from '../../core/frozen/lib/looks/presets';
import type { Look } from '../../core/frozen/lib/looks/types';
import type { ArcadeVars } from './arcade';
import type { HudVars } from './hud';
import type { PlayVars } from './play';

/** A radial light's two stops: the colour at its centre, and at its edge the colour at 0. */
export type RadialStops = { readonly centre: string; readonly edge: string };

/** What a Play screen's light is made of: the look's glow, the ground's dusk, or the error. */
export type PlayLight = 'glow' | 'dusk' | 'error';

/** Ember's glow as an alpha: the look every Ember screen is drawn in. */
export const EMBER_GLOW_ALPHA = EMBER.glow / GLOW_SCALE;

/** Alphas are written to three places, as the drawings write them. */
const ALPHA_PLACES = 1000;

const roundAlpha = (alpha: number) => Math.round(alpha * ALPHA_PLACES) / ALPHA_PLACES;

function stops(hex: string, alpha: number): RadialStops {
  return Object.freeze({ centre: rgba(hex, roundAlpha(alpha)), edge: rgba(hex, 0) });
}

/** The look's glow alpha, never past safeGlow (what lookToCssVars paints as --pl-glow). */
function lookGlowAlpha(look: Look): number {
  return Math.min(look.glow, safeGlow(look.ground, look.accent)) / GLOW_SCALE;
}

/** A screen drawn at drawnAlpha in Ember, in this look: scaled by its glow, capped at safeGlow. */
export function playGlowAlpha(look: Look, drawnAlpha: number): number {
  const scaled = (lookGlowAlpha(look) * drawnAlpha) / EMBER_GLOW_ALPHA;
  return roundAlpha(Math.min(scaled, safeGlowAlpha(look.ground, look.accent)));
}

/** A Play screen's light at the alpha Ember draws it at. */
export function playLightStops(
  look: Look,
  vars: PlayVars,
  light: PlayLight,
  drawnAlpha: number,
): RadialStops {
  if (light === 'dusk') return stops(vars.autoDusk, drawnAlpha);
  if (light === 'error') return stops(vars.error, Math.min(drawnAlpha, snagGlowAlpha(look.ground)));
  return stops(vars.accent, playGlowAlpha(look, drawnAlpha));
}

/** The snag layer: the error at the ground's snag alpha (the centre is --pl-glow-snag). */
export function playSnagStops(look: Look, vars: PlayVars): RadialStops {
  return stops(vars.error, snagGlowAlpha(look.ground));
}

export type HudGroundColours = {
  readonly glow: RadialStops;
  readonly grid: string;
  readonly scanline: string;
};

/** HUD's ground: the glow behind the core, the grid lines and the scanlines over the content. */
export function hudGroundColours(vars: HudVars): HudGroundColours {
  return Object.freeze({
    glow: Object.freeze({ centre: vars.glow, edge: rgba(vars.accent, 0) }),
    grid: vars.grid,
    scanline: vars.scanline,
  });
}

export type ArcadeGroundColours = {
  readonly page: string;
  readonly scanline: string;
};

/** Arcade's ground: the page behind a screen, and the scanlines a window draws behind its text. */
export function arcadeGroundColours(vars: Pick<ArcadeVars, 'page' | 'scan'>): ArcadeGroundColours {
  return Object.freeze({ page: vars.page, scanline: vars.scan });
}
