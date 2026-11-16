// A colour as React Native draws it, read without ever throwing, pure: the forms a style, a theme
// or a token may write (#rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl(), hsla(), and
// 'transparent'), each to its solid colour and its alpha, with a channel past 255 or an alpha past
// 1 held to the edge as React Native holds it. A form this cannot read (a colour's name, another
// syntax, nonsense) is null, so a caller that measures contrast skips it or refuses it plainly,
// and a component never throws on it. blendOver puts a colour over a ground as it is drawn.

import { mixHex, toHex } from '../../core/web/lib/look-kit/contrast';
import { hslToHex } from '../../core/web/lib/look-kit/hsl';

export type ReadColour = Readonly<{
  /** The colour without its alpha, as #RRGGBB. */
  hex: string;
  /** 0 (nothing shows) to 1 (solid). */
  alpha: number;
}>;

const CHANNEL_MAX = 255;
const PERCENT_MAX = 100;
const FULL_TURN = 360;
const HEX_RADIX = 16;
const SHORT = /^#([0-9a-f]{3,4})$/i;
const LONG = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
const RGB = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;
const HSL = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i;
const CLEAR: ReadColour = Object.freeze({ hex: toHex([0, 0, 0]), alpha: 0 });

const within = (value: number, max: number) => Math.min(Math.max(value, 0), max);

/** A number as written, or null where it is not one (two points, nothing at all). */
function numberOf(text: string | undefined): number | null {
  if (text === undefined) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function alphaOf(text: string | undefined): number | null {
  if (text === undefined) return 1;
  const value = numberOf(text);
  return value === null ? null : within(value, 1);
}

function fromHex(colour: string): ReadColour | null {
  const short = SHORT.exec(colour)?.[1];
  const digits = short ? [...short].map((digit) => digit + digit).join('') : null;
  const long = LONG.exec(digits ? `#${digits}` : colour);
  if (!long?.[1]) return null;
  const alpha = long[2] === undefined ? 1 : parseInt(long[2], HEX_RADIX) / CHANNEL_MAX;
  return { hex: `#${long[1].toUpperCase()}`, alpha };
}

function fromRgb(colour: string): ReadColour | null {
  const match = RGB.exec(colour);
  if (!match) return null;
  const red = numberOf(match[1]);
  const green = numberOf(match[2]);
  const blue = numberOf(match[3]);
  const alpha = alphaOf(match[4]);
  if (red === null || green === null || blue === null || alpha === null) return null;
  const channel = (value: number) => Math.round(within(value, CHANNEL_MAX));
  return { hex: toHex([channel(red), channel(green), channel(blue)]), alpha };
}

function fromHsl(colour: string): ReadColour | null {
  const match = HSL.exec(colour);
  if (!match) return null;
  const h = numberOf(match[1]);
  const s = numberOf(match[2]);
  const l = numberOf(match[3]);
  const alpha = alphaOf(match[4]);
  if (h === null || s === null || l === null || alpha === null) return null;
  const hsl = { h: h % FULL_TURN, s: within(s, PERCENT_MAX), l: within(l, PERCENT_MAX) };
  return { hex: hslToHex(hsl), alpha };
}

/** The colour and its alpha as React Native draws them; null for a form this cannot read. */
export function readColour(colour: string): ReadColour | null {
  // a palette is typed, but a theme's values reach here from a file: never trust the type alone
  if (typeof colour !== 'string') return null;
  if (colour.trim().toLowerCase() === 'transparent') return CLEAR;
  const read = fromHex(colour) ?? fromRgb(colour) ?? fromHsl(colour);
  return read === null ? null : Object.freeze(read);
}

/**
 * `colour` over `ground` as it is drawn, #RRGGBB: a solid colour is itself; a see-through one is
 * blended. Null where it cannot be read, or where it lets a ground through that cannot be read or
 * is not solid (that ground reads as nothing until it is itself put over what is behind it).
 */
export function blendOver(colour: string, ground: string): string | null {
  const ink = readColour(colour);
  if (ink === null) return null;
  if (ink.alpha >= 1) return ink.hex;
  const under = readColour(ground);
  if (under === null || under.alpha < 1) return null;
  return mixHex(under.hex, ink.hex, ink.alpha);
}
