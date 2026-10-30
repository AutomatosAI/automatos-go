// Arcade's window and its scanlines, pure (README 'Windows'; the design kit's app/theme.css
// --arcade-winsh and --arcade-scan at 034fa629c, sha256
// 4f1da5f677a308b4954b7b83e01308b4bde002e3ed85db022eff8ccaaa82189f). The web draws a window as
// box-shadows outside its box: a 2 px border, a gap of the window's ground out to ring2 and a
// second border out to ring3, a 1 px light and dark bevel inside, and the drop shadow, the ring
// box moved `drop` right and down (its spread is ring3, so it covers the rings exactly). On the
// phone the rings sit inside the window's layout box as nested borders, so a layout measures them:
// Classic is 2 + 2 + 2 with a 1 pt bevel and a 6 pt drop, Thin a single 2 pt line and a 4 pt drop.
// Scanlines sit behind a window's content, never over it: a line every period from the bottom in
// the tone's ink at the style's alpha (tokens/arcade.ts), and none on a ground where a line would
// take a text colour the window draws below AA. Pure: no React, React Native, Expo or Skia.

import { AA_TEXT, contrastRatio, mixHex, toHex } from '../../../core/web/lib/look-kit/contrast';
import { SCAN_ALPHA, SCAN_INK, type PaletteColours } from '../../tokens/arcade-catalogue';
import {
  ARCADE_SCANLINE_SHAPES,
  arcadePalette,
  arcadeScanColour,
  arcadeTone,
  type ArcadePaintPicks,
  type ArcadeWindowFrame,
} from '../../tokens/arcade';

/** A window's ground: the window colour (most windows) or the page (an inset, the D-pad's hub). */
export type WindowGround = 'win' | 'page';

/** The window as nested borders, outside in (points). */
export type WindowRings = {
  /** The outer ring, in the border colour (ring3 − ring2; 0 on Thin). */
  readonly outer: number;
  /** The gap between the rings, in the window colour (ring2 − border; 0 on Thin). */
  readonly gap: number;
  /** The window's own border, in the border colour. */
  readonly border: number;
  /** The light top-left and dark bottom-right lines inside the border (0 on Thin). */
  readonly bevel: number;
  /** The shadow: the ring box moved this far right and down. */
  readonly drop: number;
};

export function windowRings(frame: ArcadeWindowFrame): WindowRings {
  return Object.freeze({
    outer: frame.ring3 - frame.ring2,
    gap: frame.ring2 - frame.border,
    border: frame.border,
    bevel: frame.bevel,
    drop: frame.drop,
  });
}

/** How far the rings and bevel take a window's content in from each edge. */
export function ringsDepth(rings: WindowRings): number {
  return rings.outer + rings.gap + rings.border + rings.bevel;
}

/**
 * The colours each ground carries as text (the kit's looks/pairs.ts: the design's pairs on the
 * window, the build's on the page): what a scanline must leave at AA.
 */
export const GROUND_TEXT: Readonly<Record<WindowGround, readonly (keyof PaletteColours)[]>> =
  Object.freeze({
    win: Object.freeze(['tx', 'tx2', 'ac', 'hp', 'xp', 'mp', 'qs'] as const),
    page: Object.freeze(['tx', 'tx2', 'ac'] as const),
  });

type ScanPicks = Pick<ArcadePaintPicks, 'palette' | 'scanlines'>;

/** The ground under a scanline: the tone's ink at the style's alpha over the ground, opaque. */
export function scannedGround(look: ScanPicks, ground: WindowGround): string {
  const tone = arcadeTone(look);
  const [red, green, blue] = SCAN_INK[tone].split(',').map(Number);
  const ink = toHex([red, green, blue]);
  const base = arcadePalette(look.palette).colours[ground];
  return mixHex(base, ink, SCAN_ALPHA[tone][look.scanlines]);
}

/** The lowest contrast a text colour of the ground keeps on a scanline. */
export function scannedContrast(look: ScanPicks, ground: WindowGround): number {
  const under = scannedGround(look, ground);
  const { colours } = arcadePalette(look.palette);
  const ratios = GROUND_TEXT[ground].map((name) => contrastRatio(colours[name], under));
  return Math.min(...ratios);
}

/** The scanlines a window draws: a line `line` tall every `period`, from the bottom. */
export type ScanPlan = {
  readonly line: number;
  readonly period: number;
  readonly colour: string;
};

/** The look's scanlines on this ground; null at Off, or where a line would cut text below AA. */
export function scanPlan(look: ScanPicks, ground: WindowGround): ScanPlan | null {
  const shape = ARCADE_SCANLINE_SHAPES[look.scanlines];
  const alpha = SCAN_ALPHA[arcadeTone(look)][look.scanlines];
  if (shape.line === 0 || alpha === 0) return null;
  if (scannedContrast(look, ground) < AA_TEXT) return null;
  return Object.freeze({ line: shape.line, period: shape.period, colour: arcadeScanColour(look) });
}
