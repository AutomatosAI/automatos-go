// The outlines Candy's parts clip their Skia paint to, as SVG path data (CANDY-LAYOUT §3 and §4):
// a card's rounded box (rs on every corner, or the stage's 0 0 40 40), a circle (avatars, the
// tab bar's items) and the band's lower edge, curved as CSS draws border-radius
// 0 0 50% 50% / 0 0 14% 14% (Today) to 18% (Shelf and Team). Each is the vendored
// roundRectPath (auto/auto-path.ts) over a RoundRect, so Auto and the parts draw one kind of outline;
// a corner's radius never passes half its side, as CSS scales overlapping radii down. The parts hand
// the string to Skia.Path.MakeFromSVGString. Pure: no React, React Native, Expo or Skia.

import type { PaintSize } from '../../tokens/candy-paint';
import type { RoundRect } from '../auto/auto-geometry';
import { roundRectPath } from '../auto/auto-path';

/** A box's corner radii, clockwise from the top-left (CSS border-radius order). */
export type Corners = {
  readonly topLeft: number;
  readonly topRight: number;
  readonly bottomRight: number;
  readonly bottomLeft: number;
};

/** The band's lower edge: half the width each side, and 14 % (Today) to 18 % (Shelf, Team) of its height. */
export const BAND_CURVE = Object.freeze({ x: 0.5, min: 0.14, max: 0.18 });

/** The same radius on every corner. */
export function uniformCorners(radius: number): Corners {
  return Object.freeze({
    topLeft: radius,
    topRight: radius,
    bottomRight: radius,
    bottomLeft: radius,
  });
}

/** Never negative, never past half the side it rounds. */
function fit(radius: number, side: number): number {
  return Math.min(Math.max(0, radius), Math.max(0, side) / 2);
}

function outline(
  size: PaintSize,
  rx: RoundRect['rx'],
  ry: RoundRect['ry'] = rx,
): RoundRect {
  return {
    kind: 'rrect',
    x: 0,
    y: 0,
    w: size.w,
    h: size.h,
    rx: [fit(rx[0], size.w), fit(rx[1], size.w), fit(rx[2], size.w), fit(rx[3], size.w)],
    ry: [fit(ry[0], size.h), fit(ry[1], size.h), fit(ry[2], size.h), fit(ry[3], size.h)],
  };
}

/** A box of this size with these corners, from (0, 0). */
export function cornersPath(size: PaintSize, corners: Corners): string {
  const { topLeft, topRight, bottomRight, bottomLeft } = corners;
  return roundRectPath(outline(size, [topLeft, topRight, bottomRight, bottomLeft]));
}

/** A circle of this diameter, from (0, 0). */
export function circlePath(diameter: number): string {
  const r = diameter / 2;
  return roundRectPath(outline({ w: diameter, h: diameter }, [r, r, r, r]));
}

/** The band's depth for a view: 14 % to 18 % of its height; outside that, the nearer end. */
export function bandCurve(curve: number): number {
  if (!Number.isFinite(curve)) return BAND_CURVE.min;
  return Math.min(BAND_CURVE.max, Math.max(BAND_CURVE.min, curve));
}

/** The band: square at the top, its lower corners elliptical (half the width by `curve` of the height). */
export function bandPath(size: PaintSize, curve: number): string {
  const rx = size.w * BAND_CURVE.x;
  const ry = size.h * bandCurve(curve);
  return roundRectPath(outline(size, [0, 0, rx, rx], [0, 0, ry, ry]));
}
