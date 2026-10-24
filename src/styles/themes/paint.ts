// An installed theme's phone painting (D58, docs/theme-host/mobile.md): the mobile answer's tokens
// as Studio's colours, its tone, and its allowlisted font and mascot URLs. Pure.
//
//   'tokens'     the block's own schemes, tone null: the user's Light / Dark / System picks one
//                (System: the device); a scheme the theme leaves out holds the other's
//   'fromLooks'  the member's look painted under its tone: that scheme, whatever the phone's
//
// Only the 24 MOBILE_TOKEN_NAMES are read (services/themes/contract.py), each value 'H S% L%'
// (the vendored tripletToHex) or '#rrggbb'; anything else is dropped and logged. The three the
// Studio layout has no colour for (--background-gradient-*, --glass-border-hover) are dropped, as
// tokens/play.ts drops them, and every Studio colour the theme leaves out keeps that scheme's Studio
// value. A painting without --background or --foreground is not offered. The 10
// MOBILE_CONTRAST_PAIRS are measured with the vendored contrastRatio on the colours painted, for
// each pair the theme sets a side of (a pair left wholly to Studio is Studio's own); a pair under
// AA is logged (core's review blocks such a listing; the phone still paints what core serves).

import { contrastRatio, parseHex, toHex } from '../../core/web/lib/look-kit/contrast';
import { tripletToHex } from '../../core/web/lib/look-kit/hsl';
import { logger } from '../../lib/logger';
import { resolveScheme, type SystemScheme, type ThemeChoice } from '../theme-choice';
import { STUDIO_COLOURS, tokenName } from '../tokens/studio';
import type { ColourName, ColourScheme, Colours } from '../tokens/types';
import { allowedThemeUrl } from './file-url';
import { THEME_FONT_ROLES, type MobileBlock, type MobileTheme } from './schemas';
import type { ThemeFonts, ThemeMascot, ThemePaint } from './types';

/** services/themes/contract.py MOBILE_TOKEN_NAMES: the colours a mobile block may set. */
export const MOBILE_TOKEN_NAMES = Object.freeze([
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--input',
  '--ring',
  '--background-gradient-from',
  '--background-gradient-to',
  '--glass-border-hover',
  '--cc-hover',
  '--cc-hover-border',
] as const);

/** MOBILE_REQUIRED_TOKENS: a phone cannot draw a painting without its ground and its text. */
export const MOBILE_REQUIRED_TOKENS = Object.freeze(['--background', '--foreground'] as const);

export type ContrastKind = 'text' | 'ui';

/** MOBILE_CONTRAST_PAIRS: (text or mark, fill, kind); text at 4.5:1, a mark at 3:1 (WCAG 2.x). */
export const MOBILE_CONTRAST_PAIRS: readonly (readonly [string, string, ContrastKind])[] =
  Object.freeze([
    ['--foreground', '--background', 'text'],
    ['--card-foreground', '--card', 'text'],
    ['--popover-foreground', '--popover', 'text'],
    ['--secondary-foreground', '--secondary', 'text'],
    ['--muted-foreground', '--muted', 'text'],
    ['--primary-foreground', '--primary', 'text'],
    ['--accent-foreground', '--accent', 'text'],
    ['--destructive-foreground', '--destructive', 'text'],
    ['--primary', '--background', 'ui'],
    ['--ring', '--background', 'ui'],
  ]);

export const MOBILE_AA: Readonly<Record<ContrastKind, number>> = Object.freeze({
  text: 4.5,
  ui: 3,
});

const TOKEN_NAMES: ReadonlySet<string> = new Set(MOBILE_TOKEN_NAMES);
const HEX = /^#[0-9a-f]{6}$/i;

type SchemeValues = Readonly<Record<string, string>>;

/** One value as #RRGGBB: a triplet through the vendored converter, a hex as written; else null. */
export function themeColour(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (HEX.test(value)) return toHex(parseHex(value));
  try {
    return tripletToHex(value);
  } catch {
    return null;
  }
}

/** The scheme's readable values under their '--' names; the rest dropped and logged (names only). */
function readValues(installId: string, tokens: Readonly<Record<string, unknown>>): SchemeValues {
  const entries = Object.entries(tokens).flatMap(([name, value]) => {
    if (!TOKEN_NAMES.has(name)) return [];
    const colour = themeColour(value);
    if (colour === null) {
      logger.warn(`[styles] theme ${installId}: ${name} is not 'H S% L%' or #rrggbb; dropped`);
      return [];
    }
    return [[name, colour] as const];
  });
  return Object.freeze(Object.fromEntries(entries));
}

function paintable(values: SchemeValues | null): values is SchemeValues {
  return values !== null && MOBILE_REQUIRED_TOKENS.every((name) => name in values);
}

/**
 * Each pair under its AA minimum in the colours painted (the theme's over Studio's), among the
 * pairs the theme sets a side of (`themed`, by '--' name; every pair when omitted).
 */
export function contrastProblems(
  painted: Colours,
  themed?: ReadonlySet<string>,
): readonly string[] {
  const pairs = MOBILE_CONTRAST_PAIRS.filter(
    ([text, fill]) => !themed || themed.has(text) || themed.has(fill),
  );
  return pairs.flatMap(([text, fill, kind]) => {
    const ink = painted[tokenName(text) as ColourName];
    const ground = painted[tokenName(fill) as ColourName];
    const ratio = contrastRatio(ink, ground);
    return ratio < MOBILE_AA[kind] ? [`${text} on ${fill} ${ratio.toFixed(2)}:1`] : [];
  });
}

function isStudioColour(name: string, studio: Colours): name is ColourName {
  return Object.prototype.hasOwnProperty.call(studio, name);
}

/** The scheme's Studio set with the theme's colours laid over it. */
function overStudio(values: SchemeValues, studio: Colours): Colours {
  const overlay = Object.entries(values)
    .map(([key, value]) => [tokenName(key), value] as const)
    .filter(([name]) => isStudioColour(name, studio));
  return Object.freeze({ ...studio, ...Object.fromEntries(overlay) });
}

type Schemes = Readonly<Record<ColourScheme, SchemeValues | null>>;

function readSchemes(installId: string, block: MobileBlock): Schemes {
  const read = (scheme: ColourScheme) => {
    const tokens = block.tokens[scheme];
    const values = tokens ? readValues(installId, tokens) : null;
    return paintable(values) ? values : null;
  };
  return { light: read('light'), dark: read('dark') };
}

/** The tone the painting fixes: 'fromLooks' paints its tone's scheme; 'tokens' follows the user. */
function fixedTone(block: MobileBlock, schemes: Schemes): ColourScheme | null {
  if (block.tone && schemes[block.tone]) return block.tone;
  if (block.source === 'fromLooks') return schemes.light ? 'light' : 'dark';
  return null;
}

function logContrast(
  installId: string,
  painted: Colours,
  values: SchemeValues,
  scheme: ColourScheme,
): void {
  const problems = contrastProblems(painted, new Set(Object.keys(values)));
  if (problems.length === 0) return;
  logger.warn(`[styles] theme ${installId} ${scheme}: under AA: ${problems.join('; ')}`);
}

function colours(installId: string, schemes: Schemes, studio: StudioDefaults) {
  const painted = (scheme: ColourScheme): Colours | null => {
    const values = schemes[scheme];
    if (!values) return null;
    const result = overStudio(values, studio[scheme]);
    logContrast(installId, result, values, scheme);
    return result;
  };
  const light = painted('light');
  const dark = painted('dark');
  if (!light && !dark) return null;
  return Object.freeze({
    light: light ?? dark ?? studio.light,
    dark: dark ?? light ?? studio.dark,
  });
}

function fontsOf(block: MobileBlock): ThemeFonts {
  const entries = THEME_FONT_ROLES.flatMap((role) => {
    const url = allowedThemeUrl(block.fonts[role], 'font');
    return url ? [[role, url] as const] : [];
  });
  return Object.freeze(Object.fromEntries(entries));
}

function mascotOf(block: MobileBlock): ThemeMascot | null {
  const { mode, states } = block.mascot;
  if (mode === 'none') return null;
  const files = states.map((state) =>
    Object.freeze({
      name: state.name,
      clip: mode === 'clips' ? allowedThemeUrl(state.clip, 'mascot') : null,
      still: allowedThemeUrl(state.still, 'mascot'),
    }),
  );
  const shown = files.filter((state) => state.clip !== null || state.still !== null);
  return shown.length > 0 ? Object.freeze({ mode, states: Object.freeze(shown) }) : null;
}

export type StudioDefaults = Readonly<Record<ColourScheme, Colours>>;

/** The painting the phone keeps for this answer, or null when it cannot be painted (not offered). */
export function themePaint(
  answer: MobileTheme,
  studio: StudioDefaults = STUDIO_COLOURS,
): ThemePaint | null {
  const block = answer.mobile;
  if (!block) return null;
  const schemes = readSchemes(answer.installId, block);
  const painted = colours(answer.installId, schemes, studio);
  if (!painted) {
    logger.warn(`[styles] theme ${answer.installId} paints no --background or --foreground`);
    return null;
  }
  const mascotFiles = mascotOf(block);
  return Object.freeze({
    installId: answer.installId,
    colours: painted,
    tone: fixedTone(block, schemes),
    mascot: mascotFiles !== null,
    fonts: fontsOf(block),
    mascotFiles,
  });
}

/** The scheme a painting shows: its fixed tone, else Studio's Light / Dark / System. */
export function paintScheme(
  paint: Pick<ThemePaint, 'tone'>,
  studioScheme: ThemeChoice,
  systemScheme: SystemScheme,
): ColourScheme {
  return paint.tone ?? resolveScheme(studioScheme, systemScheme);
}

/** The colours the phone paints for this answer now, or null when it cannot be painted. */
export function themeTokens(
  answer: MobileTheme,
  studioScheme: ThemeChoice,
  systemScheme: SystemScheme,
  studio: StudioDefaults = STUDIO_COLOURS,
): Colours | null {
  const paint = themePaint(answer, studio);
  return paint ? paint.colours[paintScheme(paint, studioScheme, systemScheme)] : null;
}
