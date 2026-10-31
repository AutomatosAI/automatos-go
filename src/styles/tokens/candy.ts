// Candy's tokens on the phone (PRD-001 §4.6.2, D-CAN-7, D-CAN-9, D-ONE-SET): a look as the
// palette's own variables (candyVars: the page, the band's stops, the windows, chips, text, accent,
// the user's bubble and the three card gradients' stops in the palette's order, for Candy's own
// components), as its corners and glow (the Roundness and Glow knobs), and as the Studio-keyed set
// every shared screen reads (candyTokens). The palette decides the tone (Blush and Lilac light,
// Night bloom dark); the phone's Light / Dark / System does not apply, as on the web.
// Pure: no React, React Native, Expo or Skia.
//
// Sources: AutomatosAI/automatos-design-kit themes/candy at 3920359d5 — src/looks/prepaint.ts
// (studioVars gives the Studio keys it sets their palette colour; CANDY_ROLES keeps every one of
// them; cardVars the card stops, the first set three times with One colour; the tone rule; the
// glow's fixed .04 layer and GLOW_SCALE 33; the roundness table's corners) and src/looks/spec.ts
// (the Roundness knob's keys '16' to '40' and the Glow knob's range, their defaults, clampKnob,
// innerRadius with INNER_RATIO 0.72, the Blush preset). Since kit 1.0.1 a look's roundness is a
// choice key, a string; the phone reads it as the number it names.
// The keys prepaint.ts leaves to Studio take the accent's text colour (live, good and running), a
// blue and a violet of the card sets made readable on the page, the windows and the chips by the
// vendored readableOnAll (information and agents; a warning), with the window's colour on them,
// and the chip as Studio's accent tint, so every key is opaque #RRGGBB.

import { readableOnAll, toHex } from '../../core/web/lib/look-kit/contrast';
import {
  CARD_INK,
  CARD_SETS,
  DANGER,
  paletteById,
  type CardSetId,
  type Palette,
  type PaletteColours,
  type PaletteId,
} from './candy-catalogue';
import type { StyleRadii } from './radii';
import { STUDIO_RADII } from './studio';
import type { ColourName, ColourScheme, Colours } from './types';

/** looks/schema.json's cards and gradient choices. */
export const CANDY_CARDS = ['mix', 'single'] as const;
export type CandyCards = (typeof CANDY_CARDS)[number];
export const CANDY_GRADIENTS = ['soft', 'rich', 'vivid'] as const;
export type CandyGradient = (typeof CANDY_GRADIENTS)[number];

/** What candyVars, candyTokens and the paint read of a look: a preset or a saved Candy look. */
export type CandyPaintPicks = {
  readonly palette: PaletteId;
  readonly cards: CandyCards;
  readonly gradient: CandyGradient;
  /** The Roundness knob's choice key, '16' to '40' (a whole number of points as a string). */
  readonly roundness: string;
  readonly glow: number;
};

/** Blush's preset (spec.ts presetOf): the look a phone paints before any is chosen. */
export const CANDY_DEFAULT_PICKS: CandyPaintPicks = Object.freeze({
  palette: 'blush',
  cards: 'mix',
  gradient: 'rich',
  roundness: '28',
  glow: 6,
});

/** The palette by its id; an id outside the catalogue is a programming error. */
export function candyPalette(id: PaletteId): Palette {
  const palette = paletteById(id);
  if (!palette) throw new Error(`Candy's catalogue has no palette ${id}`);
  return palette;
}

/** The palette's tone (prepaint.json's tone rule): Blush and Lilac light, Night bloom dark. */
export function candyTone(look: Pick<CandyPaintPicks, 'palette'>): ColourScheme {
  return candyPalette(look.palette).tone;
}

// ── Corners and glow ───────────────────────────────────────────────────────────────────────

/** spec.ts's Roundness (its keys' range) and Glow knobs: whole numbers in these ranges, these defaults. */
export const CANDY_ROUNDNESS = Object.freeze({ min: 16, max: 40, default: 28 });
export const CANDY_GLOW = Object.freeze({ min: 0, max: 10, default: 6 });

/** spec.ts INNER_RATIO: inner tiles (and, on the phone, cards and windows) take r × 0.72. */
export const INNER_RATIO = 0.72;
/** prepaint.ts: the glow's fixed layer under the knob's, and the knob's scale (0.04 + glow / 33). */
export const CANDY_GLOW_BASE = 0.04;
export const CANDY_GLOW_SCALE = 33;

/** CANDY-LAYOUT §3's shadow: radius 20, offset (0, 14), Android's elevation 8. */
const SHADOW_RADIUS = 20;
const SHADOW_OFFSET_Y = 14;
const SHADOW_ELEVATION = 8;

type KnobRange = { readonly min: number; readonly max: number; readonly default: number };

/** spec.ts clampKnob: clamped and rounded to the knob's range; its default when not a number. */
function clampKnob(range: KnobRange, value: number): number {
  if (!Number.isFinite(value)) return range.default;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

/**
 * The Roundness knob's r, from its key ('28') or a number: windows and cards on the web, the edge
 * screens' window on the phone. A key that names no number is the default.
 */
export function nearestRadius(r: string | number): number {
  return clampKnob(CANDY_ROUNDNESS, typeof r === 'number' ? r : Number.parseFloat(r));
}

/** rs = round(r × 0.72) (spec.ts innerRadius): the phone's cards, tiles and windows (20 at 28). */
export function innerRadius(r: string | number): number {
  return Math.round(nearestRadius(r) * INNER_RATIO);
}

/** The look's corners under the foundation's names: rs for cards, windows, sheets and the field, pills round. */
export function candyRadii(look: Pick<CandyPaintPicks, 'roundness'>): StyleRadii {
  const rs = innerRadius(look.roundness);
  const round = STUDIO_RADII.full;
  return Object.freeze({
    tag: round,
    chip: round,
    segment: round,
    control: round,
    input: rs,
    card: rs,
    panel: rs,
    pill: round,
    sheet: rs,
    full: round,
  });
}

/** The shadow's alpha for a Glow value: the fixed .04 layer plus glow / 33. */
export function candyGlowAlpha(glow: number): number {
  return CANDY_GLOW_BASE + clampKnob(CANDY_GLOW, glow) / CANDY_GLOW_SCALE;
}

/** A card's or a window's shadow, as React Native's style takes it. */
export type CandyShadow = {
  readonly shadowColor: string;
  readonly shadowOpacity: number;
  readonly shadowRadius: number;
  readonly shadowOffset: { readonly width: number; readonly height: number };
  readonly elevation: number;
};

/** The palette's tint at the look's glow. */
export function candyShadow(look: Pick<CandyPaintPicks, 'palette' | 'glow'>): CandyShadow {
  const tint = candyPalette(look.palette).colours.tint.split(',').map(Number);
  return Object.freeze({
    shadowColor: toHex([tint[0], tint[1], tint[2]]),
    shadowOpacity: candyGlowAlpha(look.glow),
    shadowRadius: SHADOW_RADIUS,
    shadowOffset: Object.freeze({ width: 0, height: SHADOW_OFFSET_Y }),
    elevation: SHADOW_ELEVATION,
  });
}

// ── The palette's variables ────────────────────────────────────────────────────────────────

/** The palette's own colours by the kit's --candy-* names, camel-cased (prepaint.ts UI_VARIABLES). */
const PALETTE_VAR_NAMES = [
  'page',
  'bandA',
  'bandB',
  'band1',
  'band2',
  'band3',
  'win',
  'chip',
  'text',
  'quiet',
  'line',
  'border',
  'bandQuiet',
  'accent',
  'accentInk',
  'accentText',
  'userA',
  'userB',
  'userInk',
  'stageInk',
] as const satisfies readonly (keyof PaletteColours)[];

/** The three card gradients' stops, --candy-g1a to --candy-g3c. */
const CARD_STOP_NAMES = ['g1a', 'g1b', 'g1c', 'g2a', 'g2b', 'g2c', 'g3a', 'g3b', 'g3c'] as const;

/** Each card gradient's start stop by its place in the look's order (1, 2, 3): a badge's dot, a tab's. */
export const CARD_START_VARS = Object.freeze({ 1: 'g1a', 2: 'g2a', 3: 'g3a' } as const);

/** The kit's --candy-* names camel-cased: the palette's colours, the card ink, then the card stops. */
export const CANDY_VAR_NAMES = [...PALETTE_VAR_NAMES, 'cardInk', ...CARD_STOP_NAMES] as const;

export type CandyVarName = (typeof CANDY_VAR_NAMES)[number];

/** Colours as #RRGGBB, or rgba(r,g,b,a) for the see-through line: both React Native colour strings. */
export type CandyVars = Readonly<Record<CandyVarName, string>>;

/** prepaint.ts cardVars: the palette's order, or its first set on every card with One colour. */
export function candyCardOrder(
  look: Pick<CandyPaintPicks, 'palette' | 'cards'>,
): readonly [CardSetId, CardSetId, CardSetId] {
  const { order } = candyPalette(look.palette);
  return look.cards === 'single' ? [order[0], order[0], order[0]] : order;
}

function cardStops(look: Pick<CandyPaintPicks, 'palette' | 'cards'>): Record<string, string> {
  const entries = candyCardOrder(look).flatMap((id, index) => {
    const set = CARD_SETS[id];
    const n = index + 1;
    return [
      [`g${n}a`, set.a],
      [`g${n}b`, set.b],
      [`g${n}c`, set.c],
    ] as const;
  });
  return Object.fromEntries(entries);
}

export function candyVars(look: Pick<CandyPaintPicks, 'palette' | 'cards'>): CandyVars {
  const { colours } = candyPalette(look.palette);
  const own = PALETTE_VAR_NAMES.map((name) => [name, colours[name]] as const);
  return Object.freeze({
    ...Object.fromEntries(own),
    cardInk: CARD_INK,
    ...cardStops(look),
  }) as CandyVars;
}

// ── The Studio-keyed set ───────────────────────────────────────────────────────────────────

/** The opaque colours Candy paints Studio's screens with; CANDY_ROLES gives each key one. */
type CandyRole =
  | 'page'
  | 'win'
  | 'chip'
  | 'text'
  | 'quiet'
  | 'border'
  | 'accentText'
  | 'accentInk'
  | 'danger'
  | 'dangerInk'
  | 'blue'
  | 'violet';

/**
 * Every Studio key by role, the one table. prepaint.ts studioVars first: the page and its text,
 * the windows as cards, popovers and paper, the chip as the quiet grounds, the accent and the hover,
 * the accent's text colour as primary and ring with the accent's ink on it, Candy's red as
 * destructive, the opaque hairline as the borders, the quiet text as the faded text and hover
 * borders. Then the keys it leaves to Studio: live, good and running the accent's text colour; a
 * warning the violet set, information, agents and navy the blue set, each made readable, with the
 * window's colour on them; the charts the accent, blue, violet, red and quiet; text on a strong fill
 * the accent's ink; Studio's accent tint the chip.
 */
export const CANDY_ROLES: Readonly<Record<ColourName, CandyRole>> = Object.freeze({
  background: 'page',
  foreground: 'text',
  card: 'win',
  cardForeground: 'text',
  popover: 'win',
  popoverForeground: 'text',
  primary: 'accentText',
  primaryForeground: 'accentInk',
  secondary: 'chip',
  secondaryForeground: 'text',
  muted: 'chip',
  mutedForeground: 'quiet',
  accent: 'chip',
  accentForeground: 'text',
  destructive: 'danger',
  destructiveForeground: 'dangerInk',
  border: 'border',
  input: 'border',
  ring: 'accentText',
  success: 'accentText',
  successForeground: 'accentInk',
  warning: 'violet',
  warningForeground: 'win',
  info: 'blue',
  infoForeground: 'win',
  agent: 'blue',
  agentForeground: 'win',
  olive: 'accentText',
  warnInk: 'violet',
  onStrong: 'accentInk',
  ccHover: 'chip',
  ccHoverBorder: 'border',
  ccLiveDot: 'accentText',
  chart1: 'accentText',
  chart2: 'blue',
  chart3: 'violet',
  chart4: 'danger',
  chart5: 'quiet',
  paper: 'win',
  bg1: 'page',
  bg2: 'win',
  fg: 'text',
  fg2: 'quiet',
  fg3: 'quiet',
  border2: 'quiet',
  accent2: 'chip',
  navy: 'blue',
  running: 'accentText',
});

function candyRoleColours(look: Pick<CandyPaintPicks, 'palette'>): Record<CandyRole, string> {
  const { colours: c, tone } = candyPalette(look.palette);
  const grounds = [c.page, c.win, c.chip];
  return {
    page: c.page,
    win: c.win,
    chip: c.chip,
    text: c.text,
    quiet: c.quiet,
    border: c.border,
    accentText: c.accentText,
    accentInk: c.accentInk,
    danger: DANGER[tone].fill,
    dangerInk: DANGER[tone].ink,
    blue: readableOnAll(CARD_SETS.blue.a, grounds, c.text),
    violet: readableOnAll(CARD_SETS.violet.a, grounds, c.text),
  };
}

/**
 * The Studio-keyed set under Candy: exactly Studio's keys, every colour #RRGGBB, so every shared
 * screen takes the palette with no change. Only the palette decides it.
 */
export function candyTokens(look: Pick<CandyPaintPicks, 'palette'>): Colours {
  const roles = candyRoleColours(look);
  const entries = Object.entries(CANDY_ROLES).map(([name, role]) => [name, roles[role]] as const);
  return Object.freeze(Object.fromEntries(entries) as Record<ColourName, string>);
}
