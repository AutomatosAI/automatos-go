// HUD's look data on the phone (PRD-001 §4.6, KS8): looks.json's options, fixed values and presets
// copied exactly, then the same data as a vendored LookCatalogue, so the look kit's AA rules
// (safeGlow, accentTextOf, errorTextOf, duskOf) apply to HUD unchanged. HUD has no web
// counterpart yet (D59): these colours are the phone's own, and this directory is the only place
// in src/styles a colour literal may live (K14).
//
// Source: DUMPING AREA/automatos-play-command/looks.json ($schema automatos-interface-look/v0,
// interface 'command', default 'arc'). Values are copied, never retuned: a change starts there.

import { mixHex } from '../../core/web/lib/look-kit/contrast';
import { rgba } from '../../core/web/lib/look-kit/css';
import type {
  LookAccent,
  LookCatalogue,
  LookGlowRange,
  LookGround,
  LookTypeStyle,
} from '../../core/web/lib/look-kit/types';
import { SHELLS } from '../../core/frozen/lib/looks/catalogue';

export const HUD_LOOK_SOURCE = 'automatos-play-command/looks.json';
export const HUD_LOOK_SOURCE_SCHEMA = 'automatos-interface-look/v0';

/** looks.json options.accent: the accent, and the button text on it. */
export const HUD_ACCENTS = Object.freeze({
  arc: { hex: '#3FE0FF', ink: '#021116' },
  forge: { hex: '#FF8A3D', ink: '#1A0A02' },
  ghost: { hex: '#E3ECF0', ink: '#06090B' },
  nova: { hex: '#FF5CDB', ink: '#1F0219' },
  signal: { hex: '#5CFF9A', ink: '#021208' },
  gold: { hex: '#FFC94A', ink: '#1C1400' },
} as const satisfies Record<string, LookAccent>);

/** looks.json options.ground: only the page colour; text and lines are fixed (HUD_FIXED). */
export const HUD_GROUNDS = Object.freeze({
  void: { bg: '#030507' },
  carbon: { bg: '#0B0B0D' },
  navy: { bg: '#050B18' },
  ember: { bg: '#0C0806' },
} as const);

/** looks.json options.font: the display face; titlePx the brand line, labelPx the panel labels. */
export const HUD_FONTS = Object.freeze({
  raj: { family: 'Rajdhani', weight: 700, titlePx: 18, labelPx: 13 },
  chakra: { family: 'Chakra Petch', weight: 600, titlePx: 15, labelPx: 12 },
  mono: { family: 'Geist Mono', weight: 500, titlePx: 14, labelPx: 11 },
} as const);

/** looks.json options.grid: the grid lines are the accent at grid / HUD_GRID_SCALE alpha. */
export const HUD_GRID_RANGE = Object.freeze({ min: 0, max: 30 } as const);
/** looks.json options.glow: the glow is the accent at glow % alpha. */
export const HUD_GLOW_RANGE = Object.freeze({ min: 0, max: 40 } as const satisfies LookGlowRange);

/** looks.json options.scan, auto and motion: the three switches (booleans in v0). */
export const HUD_SWITCHES = Object.freeze({
  scan: { type: 'boolean' },
  auto: { type: 'boolean', meaning: 'show the Auto mascot inside the voice core' },
  motion: {
    type: 'boolean',
    meaning: 'false = all loops stop; forced false under prefers-reduced-motion',
  },
} as const);

/** looks.json fixed: the same in every look, so text keeps AA on every ground. */
export const HUD_FIXED = Object.freeze({
  text: '#E6F1F5',
  text2: '#93A6AF',
  line: 'rgba(230,241,245,.10)',
  track: 'rgba(230,241,245,.08)',
  error: '#FF6B6B',
  bodyFont: 'Geist',
  monoFont: 'Geist Mono',
} as const);

export type HudAccentKey = keyof typeof HUD_ACCENTS;
export type HudGroundKey = keyof typeof HUD_GROUNDS;
export type HudFontKey = keyof typeof HUD_FONTS;

/** A looks.json preset (automatos-interface-look/v0): the picks and the three switches. */
export type HudPreset = {
  readonly id: string;
  readonly name: string;
  readonly ground: HudGroundKey;
  readonly accent: HudAccentKey;
  readonly font: HudFontKey;
  readonly grid: number;
  readonly glow: number;
  readonly scan: boolean;
  readonly auto: boolean;
  readonly motion: boolean;
};

type Picks = Pick<HudPreset, 'ground' | 'accent' | 'font' | 'grid' | 'glow'>;
type Switches = Pick<HudPreset, 'scan' | 'auto' | 'motion'>;

function preset(id: string, name: string, picks: Picks, switches: Switches): HudPreset {
  return Object.freeze({ id, name, ...picks, ...switches });
}

/** looks.json presets, in its order. */
export const HUD_PRESETS: readonly HudPreset[] = Object.freeze([
  preset(
    'arc',
    'ARC',
    { ground: 'void', accent: 'arc', font: 'raj', grid: 14, glow: 22 },
    { scan: true, auto: true, motion: true },
  ),
  preset(
    'forge',
    'FORGE',
    { ground: 'ember', accent: 'forge', font: 'chakra', grid: 8, glow: 26 },
    { scan: false, auto: true, motion: true },
  ),
  preset(
    'ghost',
    'GHOST',
    { ground: 'carbon', accent: 'ghost', font: 'mono', grid: 6, glow: 8 },
    { scan: false, auto: false, motion: true },
  ),
  preset(
    'nova',
    'NOVA',
    { ground: 'navy', accent: 'nova', font: 'chakra', grid: 16, glow: 30 },
    { scan: true, auto: true, motion: true },
  ),
  preset(
    'signal',
    'SIGNAL',
    { ground: 'void', accent: 'signal', font: 'mono', grid: 22, glow: 18 },
    { scan: true, auto: false, motion: true },
  ),
]);

/** looks.json 'default'. */
export const HUD_DEFAULT_PRESET_ID = 'arc';

// ── The catalogue ──────────────────────────────────────────────────────────────────────────

/** HUD's variables would be --hud-* (the look kit's prefix rule, K2). */
const HUD_VAR_PREFIX = 'hud';

/** A ground's raised surface: the fixed text at 3.5 % over the bg (the panel-fill alpha). */
export const HUD_SURFACE_TINT = 0.035;

/** The panel labels' tracking (README 'Panel': the header row, letter-spacing .2em). */
export const HUD_LABEL_TRACKING = '.2em';

/** The design's largest display text: big numbers and a Mission's title (24 px). */
export const HUD_DISPLAY_PX = 24;

function groundOf(bg: string): LookGround {
  return Object.freeze({
    bg,
    surface: mixHex(bg, HUD_FIXED.text, HUD_SURFACE_TINT),
    text: HUD_FIXED.text,
    text2: HUD_FIXED.text2,
    line: HUD_FIXED.line,
    chip: HUD_FIXED.track,
    panel: rgba(HUD_FIXED.text, HUD_SURFACE_TINT),
  });
}

/** A display face as the kit's type style: brand = titlePx, card = labelPx, hero and status 24. */
function typeStyleOf(font: (typeof HUD_FONTS)[HudFontKey]): LookTypeStyle {
  return Object.freeze({
    family: font.family,
    style: 'normal',
    weight: font.weight,
    letterSpacing: HUD_LABEL_TRACKING,
    sizes: Object.freeze({
      hero: HUD_DISPLAY_PX,
      brand: font.titlePx,
      status: HUD_DISPLAY_PX,
      card: font.labelPx,
    }),
  });
}

function mapValues<T, U>(
  record: Readonly<Record<string, T>>,
  to: (value: T) => U,
): Record<string, U> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, to(value)]));
}

/**
 * HUD's looks as the look kit models a theme's catalogue (PA-9). HUD recolours no shell (its one
 * shell is the clip as drawn: Play's Bronze, unfiltered), and Auto's light is the look's accent
 * (README 'Mascot contract': light and busy set to the accent; US-017a paints the ring from the
 * look), so the one light's hex is the default look's accent and is never painted on its own.
 */
export const HUD_LOOK_CATALOGUE: LookCatalogue = Object.freeze({
  prefix: HUD_VAR_PREFIX,
  errorColour: HUD_FIXED.error,
  glow: HUD_GLOW_RANGE,
  grounds: Object.freeze(mapValues(HUD_GROUNDS, ({ bg }) => groundOf(bg))),
  accents: HUD_ACCENTS,
  typeStyles: Object.freeze(mapValues(HUD_FONTS, typeStyleOf)),
  shells: Object.freeze({ none: Object.freeze({ hex: SHELLS.bronze.hex, filter: 'none' }) }),
  lights: Object.freeze({ accent: Object.freeze({ hex: HUD_ACCENTS.arc.hex }) }),
});

export const HUD_ACCENT_KEYS = Object.freeze(Object.keys(HUD_ACCENTS) as HudAccentKey[]);
export const HUD_GROUND_KEYS = Object.freeze(Object.keys(HUD_GROUNDS) as HudGroundKey[]);
export const HUD_FONT_KEYS = Object.freeze(Object.keys(HUD_FONTS) as HudFontKey[]);
