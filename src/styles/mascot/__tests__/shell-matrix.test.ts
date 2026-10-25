import { describe, expect, it } from 'vitest';

import { SHELLS } from '../../../core/web/lib/looks/catalogue';
import {
  cssFilterToColorMatrix,
  isIdentityFilter,
  NO_FILTER,
  type ColorMatrix,
} from '../shell-matrix';

const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** The 3 x 3 linear part as Skia's 20 numbers: zero offsets, alpha passed through. */
function skia(rows: readonly (readonly [number, number, number])[]): number[] {
  return [...rows.flatMap((row) => [...row, 0, 0]), 0, 0, 0, 1, 0];
}

function expectClose(actual: ColorMatrix, expected: readonly number[], within: number): void {
  expect(actual).toHaveLength(20);
  actual.forEach((value, index) => {
    expect(Math.abs(value - (expected[index] ?? NaN))).toBeLessThanOrEqual(within);
  });
}

// Hand-computed with the W3C Filter Effects matrices (python, 24 Oct), last filter on the left.
const GOLD = skia([
  [1.1354, -0.4027, 0.3673],
  [0.0252, 1.2014, -0.1267],
  [-0.3541, 0.1806, 1.2735],
]);
const SILVER = skia([
  [0.2658, 0.894, 0.0902],
  [0.2658, 0.894, 0.0902],
  [0.2658, 0.894, 0.0902],
]);
const COBALT = skia([
  [-0.5626, 1.6782, -0.1157],
  [0.3986, 0.3723, 0.2291],
  [0.6634, 1.2711, -0.9345],
]);
const SLEEPING_DIM = skia([
  [0.3769, 0.1573, 0.0158],
  [0.0469, 0.4873, 0.0158],
  [0.0469, 0.1573, 0.3458],
]);
const HUE_THEN_SATURATE = skia([
  [-0.426424, -1.42857, 2.854994],
  [0.641576, 1.13643, -0.778006],
  [-2.148424, 2.86143, 0.286994],
]);
const SATURATE_THEN_HUE = skia([
  [-0.426, -1.43, 2.856],
  [0.642, 1.135, -0.777],
  [-2.148, 2.86, 0.288],
]);

describe('cssFilterToColorMatrix', () => {
  it("'none' and nothing are the identity", () => {
    expect(cssFilterToColorMatrix(NO_FILTER)).toEqual(IDENTITY);
    expect(cssFilterToColorMatrix('  ')).toEqual(IDENTITY);
    expect(isIdentityFilter(SHELLS.bronze.filter)).toBe(true);
    expect(isIdentityFilter(SHELLS.gold.filter)).toBe(false);
  });

  it('paints the vendored shells as the browser does', () => {
    expect(SHELLS.gold.filter).toBe('hue-rotate(18deg) saturate(1.2) brightness(1.1)');
    expect(SHELLS.silver.filter).toBe('grayscale(1) brightness(1.25)');
    expect(SHELLS.cobalt.filter).toBe('hue-rotate(195deg) saturate(1.1)');
    expectClose(cssFilterToColorMatrix(SHELLS.gold.filter), GOLD, 1e-3);
    expectClose(cssFilterToColorMatrix(SHELLS.silver.filter), SILVER, 1e-3);
    expectClose(cssFilterToColorMatrix(SHELLS.cobalt.filter), COBALT, 1e-3);
  });

  it("reads Mascot.dc.html's sleeping dim, leading dots and all", () => {
    expectClose(cssFilterToColorMatrix('brightness(.55) saturate(.6)'), SLEEPING_DIM, 1e-3);
  });

  it('every vendored shell has a matrix, so a new one fails here at the core sync', () => {
    for (const shell of Object.values(SHELLS)) {
      expect(cssFilterToColorMatrix(shell.filter)).toHaveLength(20);
    }
  });

  it('applies left to right: the order matters', () => {
    const hueFirst = cssFilterToColorMatrix('hue-rotate(90deg) saturate(3)');
    const saturateFirst = cssFilterToColorMatrix('saturate(3) hue-rotate(90deg)');
    expectClose(hueFirst, HUE_THEN_SATURATE, 1e-5);
    expectClose(saturateFirst, SATURATE_THEN_HUE, 1e-5);
    const gap = Math.max(...hueFirst.map((value, i) => Math.abs(value - (saturateFirst[i] ?? 0))));
    expect(gap).toBeGreaterThan(1e-3);
  });

  it('reads percentages and a unitless zero angle; caps grayscale at 1', () => {
    expect(cssFilterToColorMatrix('saturate(120%)')).toEqual(
      cssFilterToColorMatrix('saturate(1.2)'),
    );
    expect(cssFilterToColorMatrix('hue-rotate(0)')).toEqual(
      cssFilterToColorMatrix('hue-rotate(0deg)'),
    );
    expect(cssFilterToColorMatrix('grayscale(2)')).toEqual(cssFilterToColorMatrix('grayscale(1)'));
    expectClose(cssFilterToColorMatrix('brightness(1)'), IDENTITY, 0);
  });

  it('keeps zero offsets and passes alpha through', () => {
    const matrix = cssFilterToColorMatrix(SHELLS.cobalt.filter);
    expect([matrix[4], matrix[9], matrix[14], matrix[19]]).toEqual([0, 0, 0, 0]);
    expect(matrix.slice(15, 19)).toEqual([0, 0, 0, 1]);
  });

  it('refuses what it cannot paint', () => {
    expect(() => cssFilterToColorMatrix('sepia(1)')).toThrow(/sepia/);
    expect(() => cssFilterToColorMatrix('hue-rotate(1rad)')).toThrow();
    expect(() => cssFilterToColorMatrix('hue-rotate(18)')).toThrow(/deg/);
    expect(() => cssFilterToColorMatrix('saturate(-1)')).toThrow(/negative/);
    expect(() => cssFilterToColorMatrix('brightness(1deg)')).toThrow(/number/);
    expect(() => cssFilterToColorMatrix('url(#tint)')).toThrow();
  });
});
