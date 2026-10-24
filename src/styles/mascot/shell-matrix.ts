// Play's shell tint as a Skia colour matrix (D-MASCOT, KS11), pure. The web tints Auto's clip and
// still with the look's shell, a CSS filter (core lib/looks/catalogue.ts SHELLS, through
// components/mascot/auto-mascot.module.css .figure); a native view takes no CSS filter, so
// US-017b draws the shell through Skia's ColorMatrix with the matrix made here. Each filter
// function is its W3C Filter Effects matrix (§ 'Shorthands': hue-rotate, saturate and grayscale
// as feColorMatrix, brightness as a linear feComponentTransfer with slope n), and a list applies
// left to right as CSS does: 'a() b()' is B x A. The matrix is Skia's 20 numbers, row-major 4 x 5,
// with zero offsets. CSS clamps each step to 0-1 and one matrix does not, so an over-bright
// channel between steps can differ by its overshoot; the vendored shells stay in range.

/** Skia's colour matrix: rows R, G, B, A of [r, g, b, a, offset]. */
export type ColorMatrix = readonly number[];

/** A 3 x 3 linear part over r, g, b (alpha passes through, offsets are zero). */
type Linear = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

const IDENTITY: Linear = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** The filter that tints nothing (Play's Bronze shell, HUD, a theme's mascot). */
export const NO_FILTER = 'none';

/** feColorMatrix type="saturate" (hue-rotate and saturate share the Rec. 709 luma weights). */
function saturate(s: number): Linear {
  return [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ];
}

const DEGREES_TO_RADIANS = Math.PI / 180;

/** feColorMatrix type="hueRotate". */
function hueRotate(degrees: number): Linear {
  const c = Math.cos(degrees * DEGREES_TO_RADIANS);
  const s = Math.sin(degrees * DEGREES_TO_RADIANS);
  return [
    [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
    [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
    [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
  ];
}

/** grayscale(g): the spec's matrix with its own luma weights; g above 1 counts as 1. */
function grayscale(g: number): Linear {
  const keep = 1 - Math.min(1, g);
  return [
    [0.2126 + 0.7874 * keep, 0.7152 - 0.7152 * keep, 0.0722 - 0.0722 * keep],
    [0.2126 - 0.2126 * keep, 0.7152 + 0.2848 * keep, 0.0722 - 0.0722 * keep],
    [0.2126 - 0.2126 * keep, 0.7152 - 0.7152 * keep, 0.0722 + 0.9278 * keep],
  ];
}

function brightness(b: number): Linear {
  return [
    [b, 0, 0],
    [0, b, 0],
    [0, 0, b],
  ];
}

/** a x b: b applies first. */
function multiply(a: Linear, b: Linear): Linear {
  const cell = (i: 0 | 1 | 2, j: 0 | 1 | 2) =>
    a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  const row = (i: 0 | 1 | 2) => [cell(i, 0), cell(i, 1), cell(i, 2)] as const;
  return [row(0), row(1), row(2)];
}

/** One function, its argument and unit: 'hue-rotate(18deg)', 'brightness(.55)', 'saturate(120%)'. */
const FILTER_FUNCTION = /([a-z-]+)\(\s*(-?(?:\d+\.?\d*|\.\d+))(deg|%)?\s*\)/g;
const WHOLE_LIST = /^(?:\s*[a-z-]+\(\s*-?(?:\d+\.?\d*|\.\d+)(?:deg|%)?\s*\))+\s*$/;
const PERCENT = 100;

type Amount = { readonly value: number; readonly unit: string | undefined };

function amountOf({ value, unit }: Amount, name: string): number {
  if (unit === '%') return value / PERCENT;
  if (unit !== undefined) throw new Error(`${name}() takes a number or a percentage`);
  if (value < 0) throw new Error(`${name}() takes no negative amount`);
  return value;
}

function angleOf({ value, unit }: Amount): number {
  if (unit === 'deg' || value === 0) return value;
  throw new Error('hue-rotate() takes an angle in deg');
}

function linearOf(name: string, amount: Amount): Linear {
  switch (name) {
    case 'hue-rotate':
      return hueRotate(angleOf(amount));
    case 'saturate':
      return saturate(amountOf(amount, name));
    case 'brightness':
      return brightness(amountOf(amount, name));
    case 'grayscale':
      return grayscale(amountOf(amount, name));
    default:
      throw new Error(`the filter function ${name}() has no colour matrix here`);
  }
}

function toSkia(m: Linear): ColorMatrix {
  return Object.freeze([...m[0], 0, 0, ...m[1], 0, 0, ...m[2], 0, 0, 0, 0, 0, 1, 0]);
}

/**
 * A CSS filter as Skia's colour matrix: 'none' (or nothing) is the identity. Only hue-rotate(deg),
 * saturate, brightness and grayscale are read, the functions SHELLS uses; anything else throws, so
 * a shell the web adds with another function fails this file's test at the core sync, never a
 * render.
 */
export function cssFilterToColorMatrix(filter: string): ColorMatrix {
  const text = filter.trim();
  if (text === '' || text === NO_FILTER) return toSkia(IDENTITY);
  if (!WHOLE_LIST.test(text)) throw new Error(`'${filter}' is not a list of filter functions`);
  const steps = [...text.matchAll(FILTER_FUNCTION)].map(([, name = '', value, unit]) =>
    linearOf(name, { value: Number(value), unit }),
  );
  return toSkia(steps.reduce<Linear>((applied, step) => multiply(step, applied), IDENTITY));
}

/** True for the matrix that changes nothing: no Skia layer is needed. */
export function isIdentityFilter(filter: string): boolean {
  const text = filter.trim();
  return text === '' || text === NO_FILTER;
}
