// Arcade's tokens on the phone (PRD-001 §4.6.1, D-ARC-3, D-ONE-SET): a look as the palette's own
// variables (arcadeVars: the window, bar, text, accent, highlight and game colours, the bevels and
// the shadow as the catalogue's rgba, and the scanlines' colour, for Arcade's own components), as
// the window's and scanlines' sizes for its window style, scanlines and pixel scale, and as the
// Studio-keyed set every shared screen reads (arcadeTokens). The palette decides the tone
// (Handheld light, the others dark); the phone's Light / Dark / System does not apply, as on the web.
// Pure: no React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/arcade/src/looks/prepaint.ts at 034fa629c
// (sha256 f60ecf6ebf3ec1b5689730f314ca278c2baf840e72bd8e9eb50cd703ee4e69ff): studioVars gives the
// Studio keys it sets their palette colour (ARCADE_ROLES keeps every one of them); the keys it
// leaves to Studio take the game colours (XP gold for the warning ink, mana blue for agents, HP red
// for the last chart series) with the ground's text on them, and the highlight tinted over the page
// (accent2), so every key is opaque #RRGGBB. The status roles are PRD-268 §6.12.2's, never the
// accent (D-ARC-7): needs you the ! counter's quest yellow, working QUEST's mana blue, ready and
// done the plain text (the ✓ and the word carry them), failed HP red, needs setup and not checked
// the secondary text (the glyph and the word carry them), each far from the others on every
// palette (tokens/__tests__/arcade-status.test.ts measures it). Its
// WINDOW_STYLES and SCANLINE_SHAPES are the sizes below, px as pt; spec.ts presetOf the default
// picks. The scanlines' colour at Off is the ink at 0, never 'transparent' (Skia greys a fade to it).

import { mixHex } from '../../core/web/lib/look-kit/contrast';
import {
  ACCENT_TINT_ALPHA_DARK,
  ACCENT_TINT_ALPHA_LIGHT,
} from '../../core/web/lib/look-kit/studio-tokens';
import {
  SCAN_ALPHA,
  SCAN_INK,
  paletteById,
  type Palette,
  type PaletteId,
  type ScanlineId,
} from './arcade-catalogue';
import type { ColourName, ColourScheme, Colours } from './types';

/** looks/schema.json's windowStyle and pixelScale choices. */
export const ARCADE_WINDOW_STYLES = ['classic', 'thin'] as const;
export type ArcadeWindowStyle = (typeof ARCADE_WINDOW_STYLES)[number];
export const ARCADE_PIXEL_SCALES = ['2', '3'] as const;
export type ArcadePixelScale = (typeof ARCADE_PIXEL_SCALES)[number];

/** What arcadeVars and arcadeTokens read of a look: a preset or a saved Arcade look. */
export type ArcadePaintPicks = {
  readonly palette: PaletteId;
  readonly scanlines: ScanlineId;
  readonly windowStyle: ArcadeWindowStyle;
  readonly pixelScale: ArcadePixelScale;
};

/** Overworld's preset (spec.ts presetOf): the look a phone paints before any is chosen. */
export const ARCADE_DEFAULT_PICKS: ArcadePaintPicks = Object.freeze({
  palette: 'overworld',
  scanlines: 'soft',
  windowStyle: 'classic',
  pixelScale: '3',
});

/** The palette by its id; an id outside the catalogue is a programming error. */
export function arcadePalette(id: PaletteId): Palette {
  const palette = paletteById(id);
  if (!palette) throw new Error(`Arcade's catalogue has no palette ${id}`);
  return palette;
}

/** The palette's tone: Handheld paints light, the others dark, whatever the phone's scheme. */
export function arcadeTone(look: Pick<ArcadePaintPicks, 'palette'>): ColourScheme {
  return arcadePalette(look.palette).tone;
}

// ── Sizes ──────────────────────────────────────────────────────────────────────────────────

/**
 * A window (theme.css --arcade-winsh): a 2 pt border, the ground's ring2 gap and a ring3 outer
 * border, a bevel inside, and a drop shadow offset and spread. Thin's gap and outer ring sit under
 * its border, so one recipe draws both.
 */
export type ArcadeWindowFrame = {
  readonly border: number;
  readonly bevel: number;
  readonly ring2: number;
  readonly ring3: number;
  readonly drop: number;
  readonly spread: number;
};

export const ARCADE_WINDOW_FRAMES: Readonly<Record<ArcadeWindowStyle, ArcadeWindowFrame>> =
  Object.freeze({
    classic: Object.freeze({ border: 2, bevel: 1, ring2: 4, ring3: 6, drop: 6, spread: 6 }),
    thin: Object.freeze({ border: 2, bevel: 0, ring2: 2, ring3: 2, drop: 4, spread: 2 }),
  });

/** A scanline: a line of this height every period, behind a window's content only. */
export type ArcadeScanlineShape = { readonly line: number; readonly period: number };

export const ARCADE_SCANLINE_SHAPES: Readonly<Record<ScanlineId, ArcadeScanlineShape>> =
  Object.freeze({
    off: Object.freeze({ line: 0, period: 3 }),
    soft: Object.freeze({ line: 1, period: 3 }),
    strong: Object.freeze({ line: 2, period: 4 }),
  });

export function arcadeWindowFrame(look: Pick<ArcadePaintPicks, 'windowStyle'>): ArcadeWindowFrame {
  return ARCADE_WINDOW_FRAMES[look.windowStyle];
}

/** How many points one sprite pixel takes. */
export function arcadePixelScale(look: Pick<ArcadePaintPicks, 'pixelScale'>): number {
  return Number(look.pixelScale);
}

// ── The palette's variables ────────────────────────────────────────────────────────────────

/** The design's token names (looks.json "tokens"), then the scanlines' colour. */
export const ARCADE_VAR_NAMES = [
  'page',
  'win',
  'bar',
  'barTx',
  'tx',
  'tx2',
  'bd',
  'ac',
  'aci',
  'hl',
  'hlt',
  'hp',
  'xp',
  'mp',
  'qs',
  'sh',
  'bevl',
  'bevd',
  'scan',
] as const;

export type ArcadeVarName = (typeof ARCADE_VAR_NAMES)[number];

/** Colours as #RRGGBB or rgba(r,g,b,a), both React Native colour strings. */
export type ArcadeVars = Readonly<Record<ArcadeVarName, string>>;

/** The scanlines' colour: the tone's ink at the style's alpha (SCAN_ALPHA), 0 when Off. */
export function arcadeScanColour(look: Pick<ArcadePaintPicks, 'palette' | 'scanlines'>): string {
  const tone = arcadeTone(look);
  return `rgba(${SCAN_INK[tone]},${SCAN_ALPHA[tone][look.scanlines]})`;
}

export function arcadeVars(look: Pick<ArcadePaintPicks, 'palette' | 'scanlines'>): ArcadeVars {
  const { colours } = arcadePalette(look.palette);
  return Object.freeze({ ...colours, scan: arcadeScanColour(look) });
}

// ── The Studio-keyed set ───────────────────────────────────────────────────────────────────

/** The opaque colours Arcade paints Studio's screens with; ARCADE_ROLES gives each key one. */
type ArcadeRole =
  | 'page'
  | 'win'
  | 'tx'
  | 'tx2'
  | 'bd'
  | 'ac'
  | 'aci'
  | 'hl'
  | 'hlt'
  | 'hp'
  | 'xp'
  | 'mp'
  | 'qs'
  | 'gameInk'
  | 'hlTint';

/**
 * Every Studio key by role, the one table. prepaint.ts studioVars first: the page and its text,
 * the windows as cards, popovers and the quiet grounds, the accent as primary and ring, the menu's
 * highlight as accent, HP red as destructive, the window border as the borders, the secondary
 * text as the faded text and hover borders. Then the keys it leaves to Studio: the status roles
 * by §6.12.2 (warning quest yellow, running and the live dot mana blue, success and the success
 * ink the plain text, info the secondary text: never the accent), the warning ink XP gold, agents
 * mana blue, each with the ground's text on it (gameInk, as studioVars puts it on HP red); text on
 * a strong fill the accent's ink.
 */
export const ARCADE_ROLES: Readonly<Record<ColourName, ArcadeRole>> = Object.freeze({
  background: 'page',
  foreground: 'tx',
  card: 'win',
  cardForeground: 'tx',
  popover: 'win',
  popoverForeground: 'tx',
  primary: 'ac',
  primaryForeground: 'aci',
  secondary: 'win',
  secondaryForeground: 'tx',
  muted: 'win',
  mutedForeground: 'tx2',
  accent: 'hl',
  accentForeground: 'hlt',
  destructive: 'hp',
  destructiveForeground: 'gameInk',
  border: 'bd',
  input: 'bd',
  ring: 'ac',
  success: 'tx',
  successForeground: 'gameInk',
  warning: 'qs',
  warningForeground: 'gameInk',
  info: 'tx2',
  infoForeground: 'gameInk',
  agent: 'mp',
  agentForeground: 'gameInk',
  olive: 'tx',
  warnInk: 'xp',
  onStrong: 'aci',
  ccHover: 'win',
  ccHoverBorder: 'bd',
  ccLiveDot: 'mp',
  chart1: 'ac',
  chart2: 'mp',
  chart3: 'xp',
  chart4: 'hp',
  chart5: 'tx2',
  paper: 'win',
  bg1: 'page',
  bg2: 'win',
  fg: 'tx',
  fg2: 'tx2',
  fg3: 'tx2',
  border2: 'tx2',
  accent2: 'hlTint',
  navy: 'mp',
  running: 'mp',
});

function arcadeRoleColours(look: Pick<ArcadePaintPicks, 'palette'>): Record<ArcadeRole, string> {
  const { colours: c, tone } = arcadePalette(look.palette);
  const tint = tone === 'dark' ? ACCENT_TINT_ALPHA_DARK : ACCENT_TINT_ALPHA_LIGHT;
  return {
    page: c.page,
    win: c.win,
    tx: c.tx,
    tx2: c.tx2,
    bd: c.bd,
    ac: c.ac,
    aci: c.aci,
    hl: c.hl,
    hlt: c.hlt,
    hp: c.hp,
    xp: c.xp,
    mp: c.mp,
    qs: c.qs,
    // studioVars' onRed: the page under a dark palette's game colours, the window under Handheld's
    gameInk: tone === 'dark' ? c.page : c.win,
    // Studio's --accent-2 is its accent at the tone's tint alpha; here mixed over the page, opaque
    hlTint: mixHex(c.page, c.hl, tint),
  };
}

/**
 * The Studio-keyed set under Arcade: exactly Studio's keys, every colour #RRGGBB, so every shared
 * screen takes the palette with no change. Only the palette decides it.
 */
export function arcadeTokens(look: Pick<ArcadePaintPicks, 'palette'>): Colours {
  const roles = arcadeRoleColours(look);
  const entries = Object.entries(ARCADE_ROLES).map(([name, role]) => [name, roles[role]] as const);
  return Object.freeze(Object.fromEntries(entries) as Record<ColourName, string>);
}
