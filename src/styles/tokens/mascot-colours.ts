// The colours Auto's ring paints (D-MASCOT, Mascot.dc.html), built with the vendored rgba as the
// grounds build theirs (ground-colours.ts), so every colour the ring draws comes from this directory
// (D-TOKENS). The ring's colour is mascot/ring-palette.ts's for the state; its glow is that colour
// at 0.35 (the drawing's rgba(ring, .35), the web's color-mix 35 %), and the fill fades to the same
// colour at 0 (Skia blends a gradient unpremultiplied, so a 'transparent' stop would grey the fade).

import { rgba } from '../../core/web/lib/look-kit/css';

/** The glow's alpha over the ring colour. */
export const RING_GLOW_ALPHA = 0.35;

export type RingColours = {
  /** The 2 pt stroke: the ring colour itself. */
  readonly stroke: string;
  /** Both shadows and the fill's centre. */
  readonly glow: string;
  /** The fill's edge: the ring colour at 0. */
  readonly edge: string;
};

/** The ring's paints for a #rrggbb ring colour. */
export function ringColours(ring: string): RingColours {
  return Object.freeze({ stroke: ring, glow: rgba(ring, RING_GLOW_ALPHA), edge: rgba(ring, 0) });
}
