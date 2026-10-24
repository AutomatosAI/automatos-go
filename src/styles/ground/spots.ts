// Where each style's light sits behind a screen (D54), pure. A spot is a CSS
// radial-gradient(<rx> <ry> at <x%> <y%>, colour, transparent <fadeEnd>): an ellipse with radii
// rx and ry (CSS's two lengths are the radii), centred at a fraction of the screen, fading out by
// fadeEnd of the way to its edge. Skia draws it as a circle of radius rx squashed by ry / rx.
//
//   Play  per screen kind, from Ember's 390 pt phones ('Automatos Play Ember.dc.html', the
//         background of each phone 01-09; 03 Conversations and 05 the Deliverable draw none).
//         Screens Ember does not draw (the Command Centre, settings, sheets) take 'page': the
//         shelf's light, Ember's one list page with a light.
//   HUD   one spot on every screen: the phone core's 320 x 320 at 50 % 40 %, gone by 70 %.

import type { PlayLight } from '../tokens/ground-colours';
import { HUD_GLOW } from '../tokens/hud';

/** The screens a ground knows; the light differs per kind under Play only. */
export const SCREEN_KINDS = [
  'page',
  'chat',
  'report',
  'conversations',
  'shelf',
  'deliverable',
  'first-open',
  'not-running',
  'something-wrong',
  'lost',
] as const;

export type ScreenKind = (typeof SCREEN_KINDS)[number];

export const DEFAULT_SCREEN_KIND: ScreenKind = 'page';

export type RadialSpot = {
  readonly radiusX: number;
  readonly radiusY: number;
  /** The centre, as fractions of the screen's width and height. */
  readonly centreX: number;
  readonly centreY: number;
  /** Where the light is gone, as a fraction of the way from the centre to the edge. */
  readonly fadeEnd: number;
};

/** A Play spot: where it sits, what it is made of and its alpha as Ember draws it. */
export type PlaySpot = RadialSpot & { readonly light: PlayLight; readonly alpha: number };

/** Ember's lights fade out by 65 %; Not running's dusk by 70 %. */
const EMBER_FADE = 0.65;
const DUSK_FADE = 0.7;

function spot(
  [radiusX, radiusY]: readonly [number, number],
  [centreX, centreY]: readonly [number, number],
  alpha: number,
  light: PlayLight = 'glow',
  fadeEnd = EMBER_FADE,
): PlaySpot {
  return Object.freeze({ radiusX, radiusY, centreX, centreY, fadeEnd, light, alpha });
}

const CHAT_SIZE = [360, 260] as const;
const CHAT_CENTRE = [0.3, 0.92] as const;
const SHELF = spot([360, 300], [0.5, 0.4], 0.16);

/** Each screen's light under Play; null where Ember draws none. */
export const PLAY_SPOTS: Readonly<Record<ScreenKind, PlaySpot | null>> = Object.freeze({
  page: SHELF,
  chat: spot(CHAT_SIZE, CHAT_CENTRE, 0.2),
  report: spot(CHAT_SIZE, CHAT_CENTRE, 0.24),
  conversations: null,
  shelf: SHELF,
  deliverable: null,
  'first-open': spot([360, 300], [0.7, 0.34], 0.26),
  'not-running': spot([320, 260], [0.5, 0.3], 0.18, 'dusk', DUSK_FADE),
  'something-wrong': spot([340, 260], [0.3, 0.9], 0.16, 'error'),
  lost: spot([320, 300], [0.5, 0.4], 0.16),
});

/** HUD's glow behind the core (tokens/hud.ts HUD_GLOW: CSS's 320px 320px are the radii). */
export const HUD_SPOT: RadialSpot = Object.freeze({
  radiusX: HUD_GLOW.width,
  radiusY: HUD_GLOW.height,
  centreX: HUD_GLOW.centreX,
  centreY: HUD_GLOW.centreY,
  fadeEnd: HUD_GLOW.fadeEnd,
});

export type Size = { readonly width: number; readonly height: number };

/** A spot on a screen of this size, as Skia's RadialGradient takes it. */
export type RadialGeometry = {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  /** ry / rx: the circle squashed (or stretched) into the ellipse about its centre. */
  readonly scaleY: number;
  readonly positions: readonly [number, number];
};

export function radialGeometry(at: RadialSpot, size: Size): RadialGeometry {
  return Object.freeze({
    cx: at.centreX * size.width,
    cy: at.centreY * size.height,
    r: at.radiusX,
    scaleY: at.radiusY / at.radiusX,
    positions: [0, at.fadeEnd] as const,
  });
}
