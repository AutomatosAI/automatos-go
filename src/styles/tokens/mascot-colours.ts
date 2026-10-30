// The colours Auto's ring paints (D-MASCOT, Mascot.dc.html), built with the vendored rgba as the
// grounds build theirs (ground-colours.ts), so every colour the ring draws comes from this directory
// (D-TOKENS). The ring's colour is mascot/ring-palette.ts's for the state; its glow is that colour
// at 0.35 (the drawing's rgba(ring, .35), the web's color-mix 35 %), and the fill fades to the same
// colour at 0 (Skia blends a gradient unpremultiplied, so a 'transparent' stop would grey the fade).
// Arcade never shows the ring or the bundled clips (D-ARC-5): Auto is the kit's sprite, drawn in
// the palette's art set (the catalogue's SPRITE_COLOURS: bronze, or Handheld's four shades).
// Candy never shows them either (D-CAN-5): Auto is the kit's glossy drawing, each stop one of the
// catalogue's AUTO_COLOURS at that stop's alpha; candyAutoColour is the one place such a paint
// becomes a colour string.

import { rgba } from '../../core/web/lib/look-kit/css';
import { arcadePalette, type ArcadePaintPicks } from './arcade';
import { SPRITE_COLOURS, type SpriteKey } from './arcade-catalogue';
import { AUTO_COLOURS, type AutoColour } from './candy-catalogue';

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

/** The sprite's colour for each pixel kind, in the palette's art set. */
export function arcadeSpriteColours(
  look: Pick<ArcadePaintPicks, 'palette'>,
): Readonly<Record<SpriteKey, string>> {
  return SPRITE_COLOURS[arcadePalette(look.palette).art];
}

/** One of Auto's colours at a stop's alpha (clamped to 0–1): the colour itself when opaque. */
export function candyAutoColour(colour: AutoColour, alpha = 1): string {
  const hex = AUTO_COLOURS[colour];
  const clamped = Math.min(1, Math.max(0, alpha));
  return clamped === 1 ? hex : rgba(hex, clamped);
}
