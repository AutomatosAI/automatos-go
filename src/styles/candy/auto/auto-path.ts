// A shape of Candy's Auto as SVG path data (PRD-001 §4.6.2, D-CAN-5, KA3-VENDOR-PIN), in the
// drawing's box units: CandyAuto.tsx hands it to Skia.Path.MakeFromSVGString, and an arch (a
// celebrating eye) fills with the even-odd rule. Pure: no React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/candy/src/art/auto-path.ts at 3920359d5
// (3920359d5350960471aca1b7111f6243be537cc0), sha256
// ae691042795a6c9280e43a24b7ecc3a60432c7a902f068bae3d97a44a5a73e6c. Copied; only the layout
// (semicolons, line width) is the repo's.

import type { Arch, RoundRect, Shape } from './auto-geometry';

/**
 * A shape of Auto's as SVG path data, in the drawing's box units: a box with elliptical corners as four arcs, and an
 * arch (a celebrating eye) as its outer box less its inner one, which the path fills with the even-odd rule. The
 * rasteriser in the tests reads the same two boxes (archBoxes), so the web and the stills draw one outline. Pure.
 */

const round = (value: number): string => String(Math.round(value * 1000) / 1000);

export function roundRectPath({ x, y, w, h, rx, ry }: RoundRect): string {
  const [tl, tr, br, bl] = rx;
  const [tlY, trY, brY, blY] = ry;
  return [
    `M${round(x + tl)} ${round(y)}`,
    `L${round(x + w - tr)} ${round(y)}`,
    `A${round(tr)} ${round(trY)} 0 0 1 ${round(x + w)} ${round(y + trY)}`,
    `L${round(x + w)} ${round(y + h - brY)}`,
    `A${round(br)} ${round(brY)} 0 0 1 ${round(x + w - br)} ${round(y + h)}`,
    `L${round(x + bl)} ${round(y + h)}`,
    `A${round(bl)} ${round(blY)} 0 0 1 ${round(x)} ${round(y + h - blY)}`,
    `L${round(x)} ${round(y + tlY)}`,
    `A${round(tl)} ${round(tlY)} 0 0 1 ${round(x + tl)} ${round(y)}`,
    'Z',
  ].join(' ');
}

/** An arch's outer and inner boxes: a dome of half its height over straight sides, and the same inset by its stroke. */
export function archBoxes({ x, y, w, h, stroke }: Arch): readonly [RoundRect, RoundRect] {
  const outer: RoundRect = {
    kind: 'rrect',
    x,
    y,
    w,
    h,
    rx: [w / 2, w / 2, 0, 0],
    ry: [h / 2, h / 2, 0, 0],
  };
  const innerW = Math.max(0, w - stroke * 2);
  const innerRx = innerW / 2;
  const innerRy = Math.max(0, h / 2 - stroke);
  const inner: RoundRect = {
    kind: 'rrect',
    x: x + stroke,
    y: y + stroke,
    w: innerW,
    h: h - stroke,
    rx: [innerRx, innerRx, 0, 0],
    ry: [innerRy, innerRy, 0, 0],
  };
  return [outer, inner];
}

export function shapePath(shape: Shape): string {
  if (shape.kind === 'rrect') return roundRectPath(shape);
  const [outer, inner] = archBoxes(shape);
  return `${roundRectPath(outer)} ${roundRectPath(inner)}`;
}
