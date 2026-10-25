// Studio's tokens on the phone (PRD-001 §4.6, D-TOKENS): the source's HSL values (studio-source.ts)
// normalised to hex with the vendored look-kit converter, so a colour here is the colour the web
// renders for hsl(var(--x)); plus the handoff's radii, spacing and shadows as named tokens. This
// directory is the only place in src/styles a colour literal may live (eslint.config.js, K14).
//
// The README's published hexes (#f4eee2 background, …) are the designer's labels for these
// triplets and sit within 5/255 per channel of what the triplets render; the triplets are the
// source of truth, as on the web. __tests__/tokens.test.ts holds both.

import { tripletToHex } from '../../core/web/lib/look-kit/hsl';
import { STUDIO_TYPE } from '../type';
import { STUDIO_DARK_SOURCE, STUDIO_LIGHT_SOURCE } from './studio-source';
import { threadPaint } from './thread';
import type {
  ColourScheme,
  Colours,
  Radii,
  ShadowLayer,
  Shadows,
  Spacing,
  ThreadPaint,
  TokenName,
  Tokens,
} from './types';

const WRAPPED = /^hsl\((\d[^/]*?)(?: \/ (\d*\.?\d+))?\)$/;
const ALPHA_MAX = 255;

/** An alpha 0-1 as the two hex digits #RRGGBBAA ends with. */
export function alphaHex(alpha: number): string {
  if (!(alpha >= 0 && alpha <= 1)) throw new RangeError(`${alpha} isn't an alpha from 0 to 1`);
  return Math.round(alpha * ALPHA_MAX)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
}

/** 'H S% L%', 'hsl(H S% L%)' or 'hsl(H S% L% / A)' as #RRGGBB, or #RRGGBBAA with an alpha. */
export function sourceToHex(value: string): string {
  const match = WRAPPED.exec(value);
  if (!match) return tripletToHex(value);
  const hex = tripletToHex(match[1]);
  return match[2] === undefined ? hex : `${hex}${alphaHex(Number(match[2]))}`;
}

/** '--cc-hover-border' → 'ccHoverBorder', '--chart-1' → 'chart1' (TokenName at runtime). */
export function tokenName(key: string): string {
  return key.replace(/^--/, '').replace(/-([a-z0-9])/g, (_, next: string) => next.toUpperCase());
}

/** A '--' keyed source (Studio's, or a theme's mobile block) as hex under layout names. */
export function normaliseColours<Key extends `--${string}`>(
  source: Readonly<Record<Key, string>>,
): Readonly<Record<TokenName<Key>, string>> {
  const entries = Object.entries<string>(source).map(([key, value]) => [
    tokenName(key),
    sourceToHex(value),
  ]);
  return Object.freeze(Object.fromEntries(entries)) as Record<TokenName<Key>, string>;
}

/** Dark redefines what it changes; the rest cascades from Light, as in CSS (--running). */
export const STUDIO_COLOURS: Readonly<Record<ColourScheme, Colours>> = Object.freeze({
  light: normaliseColours(STUDIO_LIGHT_SOURCE),
  dark: normaliseColours({ ...STUDIO_LIGHT_SOURCE, ...STUDIO_DARK_SOURCE }),
});

/** README 'Radii': 2 tags · 3 reason chips · 4 segmented · 6 buttons/inputs · 8 board/needs
 *  cards · 10 panels · 12 filter pills · 14 sheet top; full is spacing.css --radius-full. */
export const STUDIO_RADII: Radii = Object.freeze({
  tag: 2,
  chip: 3,
  segment: 4,
  control: 6,
  card: 8,
  panel: 10,
  pill: 12,
  sheet: 14,
  full: 999,
});

/** spacing.css --space-1 … --space-10. */
export const STUDIO_SPACING: Spacing = Object.freeze({
  space1: 4,
  space2: 6,
  space3: 8,
  space4: 10,
  space5: 12,
  space6: 14,
  space7: 16,
  space8: 18,
  space9: 24,
  space10: 28,
});

/** spacing.css's shadow ink, hsla(30 50% 18% / a): Studio's warm brown at a low alpha. */
const SHADOW_INK = '30 50% 18%';

function layer(offsetY: number, blurRadius: number, alpha: number): ShadowLayer {
  return Object.freeze({
    offsetX: 0,
    offsetY,
    blurRadius,
    color: sourceToHex(`hsl(${SHADOW_INK} / ${alpha})`),
  });
}

/** spacing.css --shadow-*, as boxShadow layers (React Native's new architecture draws them). */
export const STUDIO_SHADOWS: Shadows = Object.freeze({
  hairline: Object.freeze([layer(1, 0, 0.05)]),
  card: Object.freeze([layer(1, 0, 0.04)]),
  active: Object.freeze([layer(1, 0, 0.06), layer(1, 4, 0.04)]),
  toast: Object.freeze([layer(4, 14, 0.08)]),
  dialog: Object.freeze([layer(18, 45, 0.14)]),
});

/** The thread's boxes and Auto's avatar (D72); declared above STUDIO_TOKENS, which reads it. */
export const STUDIO_THREAD: Readonly<Record<ColourScheme, ThreadPaint>> = Object.freeze({
  light: threadPaint(STUDIO_COLOURS.light, STUDIO_COLOURS.light.onStrong),
  // the web's white mark in both tones (Dark's on-strong is ink)
  dark: threadPaint(STUDIO_COLOURS.dark, STUDIO_COLOURS.light.onStrong),
});

const STUDIO_TOKENS: Readonly<Record<ColourScheme, Tokens>> = Object.freeze({
  light: studio('light'),
  dark: studio('dark'),
});

function studio(scheme: ColourScheme): Tokens {
  return Object.freeze({
    style: 'studio',
    scheme,
    colours: STUDIO_COLOURS[scheme],
    radii: STUDIO_RADII,
    spacing: STUDIO_SPACING,
    shadows: STUDIO_SHADOWS,
    type: STUDIO_TYPE,
    thread: STUDIO_THREAD[scheme],
  });
}

/** Studio Light or Studio Dark: the same object for the same scheme, so memoised styles hold. */
export function studioTokens(scheme: ColourScheme): Tokens {
  return STUDIO_TOKENS[scheme];
}
