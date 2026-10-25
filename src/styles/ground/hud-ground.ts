// HUD's ground on the phone (D54), pure: what HudOverlay.tsx draws, as the HUD drawing's phone
// core does ('Automatos Command HUD.dc.html'). Under the content: the radial glow (HUD_SPOT) and
// 1 pt grid lines every 32 pt, from the top-left as CSS's linear-gradient(grid 1px, transparent
// 1px) tiles them. Over the content, when the look's scan is on: the README's scanlines, a
// repeating-linear-gradient at 0deg of 1 px black at 18 % then 2 px clear, so a 1 pt line every
// 3 pt counted from the bottom. Static: nothing here moves, whatever the look's motion.

import type { HudLook } from '../hud/look-schema';
import { hudGroundColours, type HudGroundColours } from '../tokens/ground-colours';
import { HUD_GRID, HUD_SCANLINES, type HudVars } from '../tokens/hud';
import { HUD_SPOT, type RadialSpot, type Size } from './spots';

/** A filled rectangle: one grid line or one scanline. */
export type Bar = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type HudGroundPlan = {
  readonly spot: RadialSpot;
  readonly colours: HudGroundColours;
  /** False at grid 0: lines at alpha 0 are not drawn. */
  readonly grid: boolean;
  /** The look's scan: the scanlines over the content. */
  readonly scan: boolean;
};

export function hudGroundPlan(look: HudLook, vars: HudVars): HudGroundPlan {
  return Object.freeze({
    spot: HUD_SPOT,
    colours: hudGroundColours(vars),
    grid: look.grid > 0,
    scan: look.scan === 'on',
  });
}

/** Offsets 0, step, 2 x step … while under length. */
function offsets(length: number, step: number): readonly number[] {
  const count = length > 0 ? Math.ceil(length / step) : 0;
  return Array.from({ length: count }, (_, index) => index * step);
}

/** The grid's lines for a screen of this size: verticals then horizontals. */
export function gridBars(
  size: Size,
  square: number = HUD_GRID.square,
  line: number = HUD_GRID.line,
): readonly Bar[] {
  const verticals = offsets(size.width, square).map((x) => ({ x, y: 0, width: line, height: size.height }));
  const horizontals = offsets(size.height, square).map((y) => ({ x: 0, y, width: size.width, height: line }));
  return Object.freeze([...verticals, ...horizontals]);
}

/** The scanlines for a screen of this size, each line at the bottom of its period. */
export function scanlineBars(
  size: Size,
  period: number = HUD_SCANLINES.period,
  line: number = HUD_SCANLINES.line,
): readonly Bar[] {
  return Object.freeze(
    offsets(size.height, period).map((fromBottom) => ({
      x: 0,
      y: size.height - fromBottom - line,
      width: size.width,
      height: line,
    })),
  );
}
