// Play's tokens on the phone (PRD-001 §4.6, D-ONE-SET): a look painted exactly as the web paints a
// Studio page under Play (PRD-260 D3). The vendored look engine computes every colour; this file
// only converts. playTokens is the Studio-keyed set, so every shared screen takes the look with no
// change to it; playVars is Play's own --pl-* set for Play's own components; the page glow levels
// follow Auto's state as app/play-theme.css does. The tone is the ground's: the user's Light /
// Dark / System does not apply under Play, as on the web (PRD-260 K4).

import { lookToCssVars, lookToStudioTokens } from '../../core/frozen/lib/looks/engine';
import { toneOfGround } from '../../core/frozen/lib/looks/tone';
import type { Look } from '../../core/frozen/lib/looks/types';
import { pageGlow, type PageGlow } from '../../core/frozen/lib/mascot/media';
import type { MascotName } from '../../core/frozen/lib/mascot/types';
import { STUDIO_COLOURS, sourceToHex, tokenName } from './studio';
import type { ColourName, ColourScheme, Colours } from './types';

/** Paper → light; Graphite, Obsidian and Night → dark (the vendored isDarkGround). */
export function playTone(look: Look): ColourScheme {
  return toneOfGround(look.ground);
}

function isStudioColour(name: string, studio: Colours): name is ColourName {
  return Object.prototype.hasOwnProperty.call(studio, name);
}

/**
 * The tone's Studio set with the look laid over it: each triplet or pre-wrapped alias converted
 * by the foundation's sourceToHex (--accent-2 keeps its alpha as #RRGGBBAA, the Colours contract
 * every primitive's tint() reads); keys Studio lacks (--background-gradient-*,
 * --glass-border-hover) dropped; keys the look does not set keep the tone's Studio value.
 */
export function playTokens(look: Look): Colours {
  const studio = STUDIO_COLOURS[playTone(look)];
  const overlay = Object.entries(lookToStudioTokens(look))
    .map(([key, value]) => [tokenName(key), value] as const)
    .filter(([name]) => isStudioColour(name, studio))
    .map(([name, value]) => [name, sourceToHex(value)] as const);
  return Object.freeze({ ...studio, ...Object.fromEntries(overlay) });
}

/** The --pl-* variables Play's components read, re-keyed without '--pl-' (fonts are fonts.ts's). */
export const PLAY_VAR_NAMES = [
  'groundBg',
  'groundSurface',
  'groundText',
  'groundText2',
  'groundLine',
  'groundChip',
  'groundPanel',
  'sheetBg',
  'sheetText',
  'sheetAccent',
  'autoDusk',
  'error',
  'errorText',
  'glowSnag',
  'accent',
  'accentInk',
  'accentLine',
  'accentFill',
  'accentText',
  'autoShell',
  'autoShellFilter',
  'autoLight',
  'glow',
] as const;

export type PlayVarName = (typeof PLAY_VAR_NAMES)[number];

/**
 * Colours as #RRGGBB or the engine's rgba(r,g,b,a), both React Native colour strings;
 * autoShellFilter is the CSS filter the shell colour matrix is made from (US-017a).
 */
export type PlayVars = Readonly<Record<PlayVarName, string>>;

const PLAY_VAR_PREFIX = '--pl-';

/** The vendored lookToCssVars(look) under PlayVars names; the glow is already capped at safeGlow. */
export function playVars(look: Look): PlayVars {
  const vars = new Map(
    Object.entries(lookToCssVars(look)).map(([key, value]) => [
      tokenName(`--${key.slice(PLAY_VAR_PREFIX.length)}`),
      value,
    ]),
  );
  const entries = PLAY_VAR_NAMES.map((name) => {
    const value = vars.get(name);
    if (value === undefined) throw new Error(`the look engine sets no ${PLAY_VAR_PREFIX} variable for ${name}`);
    return [name, value] as const;
  });
  return Object.freeze(Object.fromEntries(entries) as Record<PlayVarName, string>);
}

/** The page glow's two layers: the look's glow colour, and the coral snag layer (glowSnag). */
export type PageGlowLayers = { readonly accent: number; readonly snag: number };

function layers(accent: number, snag: number): PageGlowLayers {
  return Object.freeze({ accent, snag });
}

/** app/play-theme.css: body::before (the glow) and body::after (the snag) opacity per data-glow. */
export const PLAY_PAGE_GLOW: Readonly<Record<PageGlow, PageGlowLayers>> = Object.freeze({
  calm: layers(0.45, 0),
  busy: layers(0.7, 0),
  bright: layers(1, 0),
  snag: layers(0, 1),
  off: layers(0, 0),
});

/** --pl-duration-glow: the page glow crossfades with Auto's state. */
export const PLAY_GLOW_CROSSFADE_MS = 600;

/** The layers behind the page while Auto is in this state (the vendored pageGlow). */
export function pageGlowLayers(state: MascotName): PageGlowLayers {
  return PLAY_PAGE_GLOW[pageGlow(state)];
}
