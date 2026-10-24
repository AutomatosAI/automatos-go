// HUD's type on the phone (its README 'Theme system' and 'Automatos Command HUD.dc.html'): the
// display face (the look's font knob) for the brand line (16 at .18em, the phone's top bar), panel
// labels (the font's labelPx 13 / 12 / 11 at .2em, capitals), big numbers (24 at .04em) and titles;
// body text is always Geist (15/1.5 the user's line, 19/1.45 Auto's), mono labels Geist Mono 500 11
// in capitals at .1em (the status row) to .16em (the state chip), buttons Geist Mono 12 in capitals
// at .14em. HUD's design has no screen titles of its own, so the large slots take its largest
// display text, 24.

import type { FontWeight } from '../fonts';
import {
  HUD_DISPLAY_PX,
  HUD_FONTS,
  HUD_LABEL_TRACKING,
  type HudFontKey,
} from '../tokens/hud-catalogue';
import { LEADING, MIN_TEXT_SIZE, TYPE_SPECS, type TypeStyle } from '../type';
import { STYLE_FACES, hudDisplayFace } from './faces';
import { roleStyle, styleTable, textStyle } from './text-style';
import { parseEm } from './tracking';
import {
  DISPLAY_SLOTS,
  TITLE_ROLES,
  type DisplaySlot,
  type StyleType,
  type TitleRole,
  type TypeOptions,
} from './types';

type HudDisplay = {
  readonly size: number;
  readonly leading: number;
  /** em */
  readonly tracking: number;
  readonly uppercase?: boolean;
};

/** The phone's top bar: 'AUTOMATOS //' at 16 px, .18em. */
export const HUD_BRAND = Object.freeze({ size: 16, leading: LEADING.heading, tracking: 0.18 });
/** Big numbers and a Mission's title: 24 px at .04em. */
export const HUD_BIG = Object.freeze({ size: HUD_DISPLAY_PX, leading: 1.1, tracking: 0.04 });
/** The same '404' every style draws behind Lost (Play's 200/0.8), decorative. */
export const HUD_LOST_NUMBER = Object.freeze({ size: 200, leading: 0.8, tracking: 0.04 });

const HUD_TYPE = Object.freeze({
  monoWeight: 500 as FontWeight,
  labelTracking: 0.1,
  eyebrowTracking: 0.16,
  buttonSize: 12,
  buttonTracking: 0.14,
  autoSize: 19,
  autoLeading: 1.45,
});

function panel(font: HudFontKey): HudDisplay {
  return {
    size: HUD_FONTS[font].labelPx,
    leading: LEADING.heading,
    tracking: parseEm(HUD_LABEL_TRACKING),
    uppercase: true,
  };
}

function displaySize(font: HudFontKey, slot: DisplaySlot): HudDisplay {
  switch (slot) {
    case 'brand':
    case 'header':
      return { ...HUD_BRAND, uppercase: true };
    case 'panel':
    case 'card':
    case 'cardSm':
      return panel(font);
    case 'lostNumber':
      return HUD_LOST_NUMBER;
    default:
      return HUD_BIG; // hero, screenLg, screen, notRunning, snag, status, number
  }
}

function display(font: HudFontKey, slot: DisplaySlot): TypeStyle {
  return textStyle({ face: hudDisplayFace(font), ...displaySize(font, slot) });
}

function title(font: HudFontKey, role: TitleRole): TypeStyle {
  const { size, leading } = TYPE_SPECS[role];
  return textStyle({ face: hudDisplayFace(font), size, leading, tracking: HUD_BIG.tracking });
}

function body(size: number, weight: FontWeight = 400, options?: TypeOptions): TypeStyle {
  const leading = size === HUD_TYPE.autoSize ? HUD_TYPE.autoLeading : LEADING.body;
  return roleStyle(STYLE_FACES.hud.body, size, weight, { leading }, options);
}

function mono(size: number, weight: FontWeight = 400, options?: TypeOptions): TypeStyle {
  return roleStyle(STYLE_FACES.hud.mono, size, weight, { leading: LEADING.body }, options);
}

function caps(size: number, tracking: number): TypeStyle {
  return roleStyle(
    STYLE_FACES.hud.mono,
    size,
    HUD_TYPE.monoWeight,
    { leading: LEADING.heading },
    { trackingEm: tracking, uppercase: true },
  );
}

export function hudType(font: HudFontKey): StyleType {
  return Object.freeze({
    title: styleTable(TITLE_ROLES, (role) => title(font, role)),
    display: styleTable(DISPLAY_SLOTS, (slot) => display(font, slot)),
    body,
    mono,
    label: caps(MIN_TEXT_SIZE, HUD_TYPE.labelTracking),
    eyebrow: caps(MIN_TEXT_SIZE, HUD_TYPE.eyebrowTracking),
    button: caps(HUD_TYPE.buttonSize, HUD_TYPE.buttonTracking),
  });
}
