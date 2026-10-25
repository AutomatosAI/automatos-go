// One text style from a face, a size, a leading and a tracking, built as type.ts builds Studio's:
// the face's PostScript name as fontFamily (no fontWeight or fontStyle: the face carries both),
// line height and tracking in points to two decimals. Every size is held at D38's 11 pt floor, so
// a layout asking body(10) gets 11. Dynamic Type is the Text primitive's TEXT_SCALING, untouched.

import type { FontWeight } from '../fonts';
import { MIN_TEXT_SIZE, type TypeStyle } from '../type';
import { faceFor, pickFace, type FaceSpec } from './faces';
import { trackingPt } from './tracking';
import type { TypeOptions } from './types';

export type TextSpec = {
  readonly face: FaceSpec;
  readonly size: number;
  readonly leading: number;
  /** em */
  readonly tracking: number;
  readonly uppercase?: boolean;
};

const DECIMALS_SCALE = 100;
const round = (value: number) => Math.round(value * DECIMALS_SCALE) / DECIMALS_SCALE;

export function textStyle(spec: TextSpec): TypeStyle {
  const size = Math.max(spec.size, MIN_TEXT_SIZE);
  const { family, weight, style } = spec.face;
  return Object.freeze({
    fontFamily: faceFor(family, weight, style),
    fontSize: size,
    lineHeight: round(size * spec.leading),
    letterSpacing: trackingPt(spec.tracking, size),
    ...(spec.uppercase ? { textTransform: 'uppercase' as const } : {}),
  });
}

/** A style's text styles for a list of keys, built once and frozen, so a lookup is stable. */
export function styleTable<K extends string>(
  keys: readonly K[],
  build: (key: K) => TypeStyle,
): (key: K) => TypeStyle {
  const table = Object.freeze(Object.fromEntries(keys.map((key) => [key, build(key)]))) as Readonly<
    Record<K, TypeStyle>
  >;
  return (key: K) => table[key];
}

/** body() and mono(): the role's face nearest the weight, the layout's options over the defaults. */
export function roleStyle(
  faces: readonly FaceSpec[],
  size: number,
  weight: FontWeight,
  defaults: { readonly leading: number },
  options: TypeOptions = {},
): TypeStyle {
  return textStyle({
    face: pickFace(faces, weight),
    size,
    leading: options.leading ?? defaults.leading,
    tracking: options.trackingEm ?? 0,
    uppercase: options.uppercase,
  });
}
