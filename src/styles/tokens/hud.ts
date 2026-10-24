// HUD's tokens on the phone (PRD-001 §4.6, D-ONE-SET): a look as the variables HUD's README
// derives (hudVars: panels, brackets, grid, glow, scanlines and the Looks drawer, for HUD's own
// components) and as the Studio-keyed set every shared screen reads (hudTokens). HUD is always
// dark, and its text colours are fixed, so they keep AA on every ground. The glow is capped as
// Play's is (KS9): never past the vendored safeGlow for the ground and accent, so text, text2, the
// accent and the error still read on the glow-tinted ground. Colours are built with the vendored
// rgba and mixHex; source: DUMPING AREA/automatos-play-command/README.md 'Theme system'.

import { mixHex } from '../../core/web/lib/look-kit/contrast';
import {
  ACCENT_FILL_ALPHA,
  ACCENT_LINE_ALPHA,
  GLOW_SCALE,
  rgba,
  safeGlow,
} from '../../core/web/lib/look-kit/css';
import {
  ACCENT_TINT_ALPHA_DARK,
  overGround,
  studioConsequence,
} from '../../core/web/lib/look-kit/studio-tokens';
import { entryOf } from '../../core/web/lib/look-kit/types';
import {
  HUD_FIXED,
  HUD_GLOW_RANGE,
  HUD_GRID_RANGE,
  HUD_LOOK_CATALOGUE,
  type HudAccentKey,
  type HudGroundKey,
} from './hud-catalogue';
import { alphaHex } from './studio';
import type { ColourName, ColourScheme, Colours } from './types';

/** What hudVars and hudTokens read of a look: a looks.json preset or a saved HUD look. */
export type HudPaintPicks = {
  readonly ground: HudGroundKey;
  readonly accent: HudAccentKey;
  readonly grid: number;
  readonly glow: number;
};

/** HUD paints dark whatever the phone's Light / Dark / System says. */
export const HUD_TONE: ColourScheme = 'dark';

/** README '--panel-fill': the accent at 3.5 %. */
export const HUD_PANEL_FILL_ALPHA = 0.035;
/** README 'Panel': a 1 pt border at the accent's 14-20 % (the drawing draws none); 18 % here. */
export const HUD_PANEL_BORDER_ALPHA = 0.18;
/** The corner brackets' accent alpha, as the HUD drawing paints them (KS12). */
export const HUD_BRACKET_ALPHA = 0.7;
/** README '--grid': the accent at grid / 300. */
export const HUD_GRID_SCALE = 300;

/** Corner brackets: 14 x 1.5 pt L-shapes at all four corners (KS12). */
export const HUD_BRACKET = Object.freeze({ length: 14, thickness: 1.5 });
/** The phone's grid: 1 pt lines in 32 pt squares (40 on the desktop). */
export const HUD_GRID = Object.freeze({ square: 32, line: 1 });
/** The phone's glow: a radial 320 x 320 at 50 % 40 %, transparent by 70 % (the drawing's). */
export const HUD_GLOW = Object.freeze({
  width: 320,
  height: 320,
  centreX: 0.5,
  centreY: 0.4,
  fadeEnd: 0.7,
});
/** README 'Scanlines': a 1 pt line every 3 pt, over the content, never taking a touch. */
export const HUD_SCANLINES = Object.freeze({ line: 1, period: 3 });

const SCANLINE_COLOUR = 'rgba(0,0,0,.18)';
const DRAWER_COLOUR = 'rgba(5,8,10,.82)';

/** The README's derived variables, re-keyed as layout names ('--accent-line' → accentLine). */
export const HUD_VAR_NAMES = [
  'bg',
  'accent',
  'accentInk',
  'accentLine',
  'accentFill',
  'panelFill',
  'panelBorder',
  'bracket',
  'grid',
  'glow',
  'scanline',
  'drawer',
  'text',
  'text2',
  'line',
  'track',
  'error',
] as const;

export type HudVarName = (typeof HUD_VAR_NAMES)[number];

/** Colours as #RRGGBB or rgba(r,g,b,a), both React Native colour strings. */
export type HudVars = Readonly<Record<HudVarName, string>>;

type Range = { readonly min: number; readonly max: number };

function within(range: Range, value: number): number {
  return Math.min(Math.max(value, range.min), range.max);
}

/** The glow HUD paints: the look's, never past the vendored safeGlow for its ground and accent. */
export function hudGlow(look: HudPaintPicks): number {
  const cap = safeGlow(HUD_LOOK_CATALOGUE, look.ground, look.accent);
  return Math.min(within(HUD_GLOW_RANGE, look.glow), cap);
}

export function hudVars(look: HudPaintPicks): HudVars {
  const { bg } = entryOf(HUD_LOOK_CATALOGUE.grounds, look.ground, 'ground');
  const { hex, ink } = entryOf(HUD_LOOK_CATALOGUE.accents, look.accent, 'accent');
  const vars: Record<HudVarName, string> = {
    bg,
    accent: hex,
    accentInk: ink,
    accentLine: rgba(hex, ACCENT_LINE_ALPHA),
    accentFill: rgba(hex, ACCENT_FILL_ALPHA),
    panelFill: rgba(hex, HUD_PANEL_FILL_ALPHA),
    panelBorder: rgba(hex, HUD_PANEL_BORDER_ALPHA),
    bracket: rgba(hex, HUD_BRACKET_ALPHA),
    grid: rgba(hex, within(HUD_GRID_RANGE, look.grid) / HUD_GRID_SCALE),
    glow: rgba(hex, hudGlow(look) / GLOW_SCALE),
    scanline: SCANLINE_COLOUR,
    drawer: DRAWER_COLOUR,
    text: HUD_FIXED.text,
    text2: HUD_FIXED.text2,
    line: HUD_FIXED.line,
    track: HUD_FIXED.track,
    error: HUD_FIXED.error,
  };
  return Object.freeze(vars);
}

// ── The Studio-keyed set ───────────────────────────────────────────────────────────────────

/** The opaque colours HUD paints Studio's screens with; HUD_ROLES gives each Studio key one. */
type HudRole =
  | 'bg'
  | 'text'
  | 'text2'
  | 'accent'
  | 'accentInk'
  | 'card'
  | 'fill'
  | 'line'
  | 'border'
  | 'muted'
  | 'input'
  | 'error'
  | 'errorInk'
  | 'errorTint'
  | 'chart2'
  | 'chart3'
  | 'chart4';

/**
 * Every Studio key by role, the one table: fills and lines from the README's variables over the
 * bg; consequence (--accent, --destructive) the fixed error; every live, good or agent colour
 * the accent (HUD says what a status is in a glyph plus a WORD, never in colour alone);
 * information, faded text and the last chart series text2; text on the accent its ink.
 */
const HUD_ROLES: Readonly<Record<ColourName, HudRole>> = Object.freeze({
  background: 'bg',
  foreground: 'text',
  card: 'card',
  cardForeground: 'text',
  popover: 'card',
  popoverForeground: 'text',
  primary: 'accent',
  primaryForeground: 'accentInk',
  secondary: 'fill',
  secondaryForeground: 'text',
  muted: 'muted',
  mutedForeground: 'text2',
  accent: 'error',
  accentForeground: 'errorInk',
  destructive: 'error',
  destructiveForeground: 'errorInk',
  border: 'border',
  input: 'input',
  ring: 'accent',
  success: 'accent',
  successForeground: 'accentInk',
  warning: 'accent',
  warningForeground: 'accentInk',
  info: 'text2',
  infoForeground: 'bg',
  agent: 'accent',
  agentForeground: 'accentInk',
  olive: 'accent',
  warnInk: 'accent',
  onStrong: 'accentInk',
  ccHover: 'fill',
  ccHoverBorder: 'line',
  ccLiveDot: 'accent',
  chart1: 'accent',
  chart2: 'chart2',
  chart3: 'chart3',
  chart4: 'chart4',
  chart5: 'text2',
  paper: 'card',
  bg1: 'bg',
  bg2: 'fill',
  fg: 'text',
  fg2: 'text2',
  fg3: 'text2',
  border2: 'line',
  accent2: 'errorTint',
  navy: 'text2',
  running: 'accent',
});

/** --chart-2, -3 and -4: the accent at 0.8, 0.6 and 0.4 over the bg (--chart-1 is the accent). */
export const HUD_CHART_ALPHAS = Object.freeze([0.8, 0.6, 0.4] as const);

function hudPalette(look: HudPaintPicks): Readonly<Record<HudRole, string>> {
  const vars = hudVars(look);
  const over = (colour: string) => overGround(colour, vars.bg);
  const chart = (alpha: number) => mixHex(vars.bg, vars.accent, alpha);
  const consequence = studioConsequence(HUD_LOOK_CATALOGUE, look.ground);
  const [chart2, chart3, chart4] = HUD_CHART_ALPHAS.map(chart);
  return {
    bg: vars.bg,
    text: vars.text,
    text2: vars.text2,
    accent: vars.accent,
    accentInk: vars.accentInk,
    card: over(vars.panelFill),
    fill: over(vars.accentFill),
    line: over(vars.accentLine),
    border: over(vars.panelBorder),
    muted: over(vars.track),
    input: over(vars.line),
    error: consequence.fill,
    errorInk: consequence.ink,
    errorTint: `${consequence.fill}${alphaHex(ACCENT_TINT_ALPHA_DARK)}`,
    chart2,
    chart3,
    chart4,
  };
}

/**
 * The Studio-keyed set under HUD: exactly Studio's keys, every colour #RRGGBB (accent2 the error
 * at Studio Dark's tint alpha, #RRGGBBAA), so every shared screen takes the look with no change.
 */
export function hudTokens(look: HudPaintPicks): Colours {
  const palette = hudPalette(look);
  const entries = Object.entries(HUD_ROLES).map(([name, role]) => [name, palette[role]] as const);
  return Object.freeze(Object.fromEntries(entries) as Record<ColourName, string>);
}
