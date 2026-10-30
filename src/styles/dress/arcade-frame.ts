// Arcade's window on a shared panel (README 'Windows', D-ONE-SET), pure: the Card primitive draws a
// panel as one box with a border and a boxShadow list, so the Command Centre's cards wear Arcade's
// window through those two alone. The design kit's theme.css --arcade-winsh (034fa629c) draws a
// window as box shadows outside its box; on the phone the rings sit inside the panel's own box, as
// ArcadeWindow's do (arcade/parts/window-frame.ts), so a list spacing cards measures them:
//
//   the border    the window's outer line (Classic's outer ring, Thin's one line)
//   inset layers  top first, as --arcade-winsh lists them: the gap in the window colour, the inner
//                 line, then the bevel (light on the top and left over dark on the bottom and right)
//   the drop      the one shadow outside: the box moved `drop` right and down, no blur (hard edges)
//
// Thin has no gap, inner line or bevel: its border is its one line, then its drop.

import type { WindowRings } from '../arcade/parts/window-frame';
import type { GlowLayer } from './paints';

export type ArcadeFrameColours = {
  /** The window's lines: the border colour, or the accent round a selected panel. */
  readonly line: string;
  /** Between the lines: the window colour. */
  readonly gap: string;
  readonly bevelLight: string;
  readonly bevelDark: string;
  readonly shadow: string;
};

export type ArcadePanelFrame = {
  /** The panel's border: the window's outer line. */
  readonly borderWidth: number;
  /** The rest of the window as React Native box shadows, the first on top. */
  readonly layers: readonly GlowLayer[];
};

/** A hard-edged inset band, `spread` deep from the border, moved by the offset. */
function band(offset: number, spread: number, color: string): GlowLayer {
  return {
    offsetX: offset,
    offsetY: offset,
    blurRadius: 0,
    spreadDistance: spread,
    color,
    inset: true,
  };
}

/** The bevel at `depth`: a 1 pt light line top-left over a dark one bottom-right. */
function bevel(rings: WindowRings, depth: number, colours: ArcadeFrameColours): GlowLayer[] {
  if (rings.bevel === 0) return [];
  return [
    band(rings.bevel, depth, colours.bevelLight),
    band(-rings.bevel, depth, colours.bevelDark),
  ];
}

/** The window of this look's style on a panel, its lines in `colours.line`. */
export function arcadePanelFrame(
  rings: WindowRings,
  colours: ArcadeFrameColours,
): ArcadePanelFrame {
  const doubled = rings.outer > 0;
  const depth = doubled ? rings.gap + rings.border : 0;
  const lines = doubled ? [band(0, rings.gap, colours.gap), band(0, depth, colours.line)] : [];
  const drop: GlowLayer = {
    offsetX: rings.drop,
    offsetY: rings.drop,
    blurRadius: 0,
    spreadDistance: 0,
    color: colours.shadow,
  };
  return Object.freeze({
    borderWidth: doubled ? rings.outer : rings.border,
    layers: Object.freeze([...lines, ...bevel(rings, depth, colours), drop]),
  });
}
