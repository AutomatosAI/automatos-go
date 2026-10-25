// HUD's Looks drawer (US-018c, D55, 'Automatos Command HUD.dc.html'), pure: what the drawer draws
// for the phone's HUD looks — the status line, the looks row (the five presets, then the saved
// looks), Accent, Background and Type with the option selected, the Grid and Glow sliders (the
// glow stopping at the vendored safeGlow, KS9), the SCAN, AUTO and MOTION switches — and every
// change it makes, over US-018a's rules (hud-looks.ts). The phone's Reduce Motion holds HUD still
// whatever the look says (its README 'Reduced motion'): the MOTION switch then reads off, says
// 'MOTION OFF · REDUCE MOTION' and cannot turn motion on. Colours are the catalogue's (K14); the
// drawer hands each new HudLooks to the style store, and the look sync sends it (US-017d).

import { safeGlow } from '../../core/web/lib/look-kit/css';
import { glowWords } from '../play/look-page';
import { HUD_DRAWER_COPY, HUD_LOOK_COPY, PLAY_LOOK_COPY } from '../strings';
import { LEADING, type TypeStyle } from '../type';
import { hudDisplayFace } from '../typeface/faces';
import { textStyle } from '../typeface/text-style';
import {
  HUD_ACCENTS,
  HUD_ACCENT_KEYS,
  HUD_FONT_KEYS,
  HUD_GLOW_RANGE,
  HUD_GRID_RANGE,
  HUD_GROUNDS,
  HUD_GROUND_KEYS,
  HUD_LOOK_CATALOGUE,
  type HudAccentKey,
  type HudFontKey,
  type HudGroundKey,
} from '../tokens/hud-catalogue';
import { hudGlow, type HudVars } from '../tokens/hud';
import { resetLook, setKnob, statusLine, type HudLooks } from './hud-looks';
import { HUD_PRESET_LOOKS, type HudLook, type HudSwitch } from './look-schema';

/** The drawing's numbers for the drawer, in points (372 pt wide, full height on the phone). */
export const HUD_DRAWER = Object.freeze({
  width: 372,
  pad: 22,
  gap: 18,
  edge: 1,
  pressedOpacity: 0.7,
  title: Object.freeze({ size: 22, tracking: 0.2 }),
  status: Object.freeze({ size: 11, tracking: 0.1 }),
  heading: Object.freeze({ size: 11, tracking: 0.16, gap: 8 }),
  /** A selected option's line in the accent; the others' in the fixed line. */
  selectedLine: 1.5,
  restLine: 1,
  card: Object.freeze({
    width: 96,
    gap: 8,
    swatch: 58,
    ring: 40,
    ringLine: 2,
    ringGlow: 12,
    ringInset: 8,
    padX: 8,
    padY: 6,
    nameSize: 11,
    nameTracking: 0.08,
    rowPadBottom: 6,
  }),
  accent: Object.freeze({ size: 36, border: 2, ring: 2, gap: 10 }),
  ground: Object.freeze({
    height: 40,
    swatch: 18,
    swatchLine: 1,
    gap: 6,
    inner: 8,
    padX: 10,
    size: 12,
  }),
  font: Object.freeze({ height: 44, gap: 6, size: 15, tracking: 0.1 }),
  sliders: Object.freeze({ gap: 6, between: 6 }),
  switches: Object.freeze({ height: 44, gap: 6, size: 11, tracking: 0.1 }),
  actions: Object.freeze({ height: 46, gap: 8, size: 12, tracking: 0.14, resetPadX: 14 }),
});

export type DrawerFrame = { readonly borderWidth: number; readonly borderColor: string };

/** An option's frame, as the drawing's sel(): 1.5 pt in the accent when selected, else 1 pt. */
export function drawerFrame(
  selected: boolean,
  vars: Pick<HudVars, 'accent' | 'line'>,
): DrawerFrame {
  return selected
    ? Object.freeze({ borderWidth: HUD_DRAWER.selectedLine, borderColor: vars.accent })
    : Object.freeze({ borderWidth: HUD_DRAWER.restLine, borderColor: vars.line });
}

/** A display face at the drawing's size and tracking: 'LOOK' at 22 / .2em, a Type option at 15. */
export function drawerFace(font: HudFontKey, size: number, trackingEm: number): TypeStyle {
  const face = hudDisplayFace(font);
  return textStyle({ face, size, leading: LEADING.heading, tracking: trackingEm, uppercase: true });
}

/** A look in the drawer's row: its swatch is its ground with a ring in its accent. */
export type DrawerLook = {
  readonly look: HudLook;
  readonly ground: string;
  readonly accent: string;
  readonly selected: boolean;
  /** One of the user's saved looks: a long press opens Rename and Delete. */
  readonly own: boolean;
  /** What VoiceOver reads: 'ARC, selected'. */
  readonly label: string;
};

export type DrawerOption<K extends string> = {
  readonly key: K;
  /** As the drawer writes it: 'VOID', 'RAJDHANI'; an accent's circle draws no name. */
  readonly text: string;
  /** The accent's circle or the ground's square; null for Type. */
  readonly colour: string | null;
  readonly selected: boolean;
  /** What VoiceOver reads: 'Void background, selected'. */
  readonly label: string;
};

export type DrawerSection<K extends string> = {
  readonly title: string;
  readonly options: readonly DrawerOption<K>[];
};

export type DrawerSlider = {
  readonly knob: 'grid' | 'glow';
  readonly title: string;
  readonly min: number;
  readonly max: number;
  /** Where the thumb stops: max for the grid, the look's safeGlow for the glow. */
  readonly cap: number;
  /** What HUD paints, shown at the right. */
  readonly value: number;
  readonly label: string;
  /** The value in words for VoiceOver. */
  readonly words: (value: number) => string;
};

export type HudSwitchKnob = 'scan' | 'auto' | 'motion';

export type DrawerSwitch = {
  readonly knob: HudSwitchKnob;
  /** 'SCAN ON', 'MOTION OFF'. */
  readonly text: string;
  readonly on: boolean;
  /** MOTION while Reduce Motion holds HUD still: it reads off and takes no press. */
  readonly disabled: boolean;
  readonly label: string;
};

export type HudDrawer = {
  /** 'ARC', 'ARC · EDITED', or a saved look's name. */
  readonly status: string;
  readonly looks: readonly DrawerLook[];
  readonly accent: DrawerSection<HudAccentKey>;
  readonly ground: DrawerSection<HudGroundKey>;
  readonly font: DrawerSection<HudFontKey>;
  readonly grid: DrawerSlider;
  readonly glow: DrawerSlider;
  readonly switches: readonly DrawerSwitch[];
  /** 'MOTION OFF · REDUCE MOTION' while the phone's Reduce Motion is on; else null. */
  readonly motionNote: string | null;
  /** RESET would change something: the active look differs from the look it was picked from. */
  readonly canReset: boolean;
};

const said = HUD_DRAWER_COPY;
export const HUD_SWITCH_KNOBS = Object.freeze(['scan', 'auto', 'motion'] as const);

function drawerLook(look: HudLook, activeId: string, own: boolean): DrawerLook {
  const selected = look.id === activeId;
  return Object.freeze({
    look,
    ground: HUD_GROUNDS[look.ground].bg,
    accent: HUD_ACCENTS[look.accent].hex,
    selected,
    own,
    label: said.look(look.name, selected),
  });
}

/** The looks row: the five presets in looks.json's order, then the saved looks. */
export function drawerLooks(looks: HudLooks): readonly DrawerLook[] {
  const { active, saved } = looks;
  return Object.freeze([
    ...HUD_PRESET_LOOKS.map((look) => drawerLook(look, active.id, false)),
    ...saved.map((look) => drawerLook(look, active.id, true)),
  ]);
}

type Kind = keyof typeof said.kinds;

function option<K extends string>(
  kind: Kind,
  key: K,
  name: string,
  current: K,
  colour: string | null,
): DrawerOption<K> {
  const selected = key === current;
  const label = PLAY_LOOK_COPY.option(name, said.kinds[kind], selected);
  return Object.freeze({ key, text: name.toUpperCase(), colour, selected, label });
}

function accentSection(look: HudLook): DrawerSection<HudAccentKey> {
  const options = HUD_ACCENT_KEYS.map((key) =>
    option('accent', key, said.accents[key], look.accent, HUD_ACCENTS[key].hex),
  );
  return Object.freeze({ title: said.accentTitle(said.accents[look.accent]), options });
}

function groundSection(look: HudLook): DrawerSection<HudGroundKey> {
  const options = HUD_GROUND_KEYS.map((key) =>
    option('ground', key, said.grounds[key], look.ground, HUD_GROUNDS[key].bg),
  );
  return Object.freeze({ title: said.background, options });
}

function fontSection(look: HudLook): DrawerSection<HudFontKey> {
  const options = HUD_FONT_KEYS.map((key) => option('font', key, said.fonts[key], look.font, null));
  return Object.freeze({ title: said.type, options });
}

/** The strongest glow the look's ground and accent keep readable (the vendored safeGlow). */
export function glowCap(look: Pick<HudLook, 'ground' | 'accent'>): number {
  return safeGlow(HUD_LOOK_CATALOGUE, look.ground, look.accent);
}

function gridSlider(look: HudLook): DrawerSlider {
  const { min, max } = HUD_GRID_RANGE;
  const words = (value: number) => said.gridWords(value, max);
  const label = HUD_LOOK_COPY.knobs.grid;
  const value = look.grid;
  return Object.freeze({ knob: 'grid', title: said.grid, min, max, cap: max, value, label, words });
}

function glowSlider(look: HudLook): DrawerSlider {
  const { min, max } = HUD_GLOW_RANGE;
  const cap = glowCap(look);
  const words = (value: number) => glowWords(value, cap);
  const label = HUD_LOOK_COPY.knobs.glow;
  const value = hudGlow(look);
  return Object.freeze({ knob: 'glow', title: said.glow, min, max, cap, value, label, words });
}

/** True when the phone's Reduce Motion holds this switch off. */
function forcedOff(knob: HudSwitchKnob, reduceMotion: boolean): boolean {
  return knob === 'motion' && reduceMotion;
}

function drawerSwitch(look: HudLook, knob: HudSwitchKnob, reduceMotion: boolean): DrawerSwitch {
  const disabled = forcedOff(knob, reduceMotion);
  const on = !disabled && look[knob] === 'on';
  const label = disabled ? said.motionForcedLabel : HUD_LOOK_COPY.knobs[knob];
  const text = said.switchText(said.switches[knob], on);
  return Object.freeze({ knob, text, on, disabled, label });
}

/** Everything the drawer draws for the phone's HUD looks. */
export function hudDrawer(looks: HudLooks, reduceMotion: boolean): HudDrawer {
  const look = looks.active;
  return Object.freeze({
    status: statusLine(look, looks.saved),
    looks: drawerLooks(looks),
    accent: accentSection(look),
    ground: groundSection(look),
    font: fontSection(look),
    grid: gridSlider(look),
    glow: glowSlider(look),
    switches: Object.freeze(HUD_SWITCH_KNOBS.map((knob) => drawerSwitch(look, knob, reduceMotion))),
    motionNote: reduceMotion ? said.motionForced : null,
    canReset: resetLook(looks) !== looks,
  });
}

// ── Changes ────────────────────────────────────────────────────────────────────────────────

export type DrawerPick =
  | { readonly knob: 'accent'; readonly value: HudAccentKey }
  | { readonly knob: 'ground'; readonly value: HudGroundKey }
  | { readonly knob: 'font'; readonly value: HudFontKey };

/** Accent, Background or Type picked: the active look with that one knob changed. */
export function pickOption(looks: HudLooks, pick: DrawerPick): HudLooks {
  return setKnob(looks, pick.knob, pick.value);
}

/** A slider moved: the grid within 0 to 30, the glow within 0 and the look's cap (KS9). */
export function slide(looks: HudLooks, knob: DrawerSlider['knob'], value: number): HudLooks {
  if (knob === 'grid') return setKnob(looks, 'grid', value);
  return setKnob(looks, 'glow', Math.min(value, glowCap(looks.active)));
}

function flipped(value: HudSwitch): HudSwitch {
  return value === 'on' ? 'off' : 'on';
}

/** A switch pressed: on becomes off and back; MOTION changes nothing under Reduce Motion. */
export function flipSwitch(looks: HudLooks, knob: HudSwitchKnob, reduceMotion: boolean): HudLooks {
  if (forcedOff(knob, reduceMotion)) return looks;
  return setKnob(looks, knob, flipped(looks.active[knob]));
}
