// The outlines Candy's parts clip their paint to (shapes.ts): a card's corners (rs, or one per
// corner), a circle, and the band's curved lower edge as CSS's border-radius 0 0 50% 50% / 0 0
// 14% 14% (to 18 %) draws it, each the vendored roundRectPath, every radius held to half its side.

import { describe, expect, it } from 'vitest';

import { roundRectPath } from '../../auto/auto-path';
import { BAND_CURVE, bandCurve, bandPath, circlePath, cornersPath, uniformCorners } from '../shapes';

const rrect = (
  w: number,
  h: number,
  rx: [number, number, number, number],
  ry: [number, number, number, number] = rx,
) => roundRectPath({ kind: 'rrect', x: 0, y: 0, w, h, rx, ry });

describe('cornersPath', () => {
  it('rounds every corner by rs', () => {
    expect(cornersPath({ w: 132, h: 156 }, uniformCorners(20))).toBe(
      rrect(132, 156, [20, 20, 20, 20]),
    );
  });

  it("draws the stage's square top and 40 pt lower corners", () => {
    const stage = { topLeft: 0, topRight: 0, bottomRight: 40, bottomLeft: 40 };
    expect(cornersPath({ w: 390, h: 290 }, stage)).toBe(rrect(390, 290, [0, 0, 40, 40]));
  });

  it('never rounds past half a side, nor below nothing', () => {
    expect(cornersPath({ w: 30, h: 20 }, uniformCorners(28))).toBe(
      rrect(30, 20, [15, 15, 15, 15], [10, 10, 10, 10]),
    );
    expect(cornersPath({ w: 30, h: 20 }, uniformCorners(-4))).toBe(rrect(30, 20, [0, 0, 0, 0]));
  });

  it('starts at the top-left, closes, and reads as Skia SVG path data', () => {
    const path = cornersPath({ w: 100, h: 50 }, uniformCorners(10));
    expect(path.startsWith('M10 0')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(path).toMatch(/^[MLAZ0-9 .-]+$/);
  });
});

describe('circlePath', () => {
  it('is a box rounded by half its diameter', () => {
    expect(circlePath(40)).toBe(rrect(40, 40, [20, 20, 20, 20]));
  });
});

describe('bandPath', () => {
  it("curves Today's 440 pt band by half the width and 14 % of its height", () => {
    expect(bandPath({ w: 390, h: 440 }, 0.14)).toBe(
      rrect(390, 440, [0, 0, 195, 195], [0, 0, 440 * 0.14, 440 * 0.14]),
    );
  });

  it("curves Shelf's and Team's 300 pt band by 18 %", () => {
    expect(bandPath({ w: 390, h: 300 }, 0.18)).toBe(
      rrect(390, 300, [0, 0, 195, 195], [0, 0, 54, 54]),
    );
  });

  it('holds the curve between 14 % and 18 %, and reads a curve that is not a number as 14 %', () => {
    expect(BAND_CURVE).toEqual({ x: 0.5, min: 0.14, max: 0.18 });
    expect([0.05, 0.16, 0.3, Number.NaN].map(bandCurve)).toEqual([0.14, 0.16, 0.18, 0.14]);
    expect(bandPath({ w: 390, h: 300 }, 0.5)).toBe(bandPath({ w: 390, h: 300 }, 0.18));
  });
});
