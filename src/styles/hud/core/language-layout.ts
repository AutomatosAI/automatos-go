// HUD's button row with the EN/PT switch (27 Oct 2026), by the phone's width. Pure: no React, React
// Native or Expo. The centre group is a twin room, HOLD TO TALK and the switch; with TYPE and STOP at
// the sides and HUD's 24 pt padding, the full 44 pt switch leaves about 7 pt between the groups on a
// 375 pt phone, which larger Dynamic Type eats. Below COMPACT_BELOW the switch and its twin room are
// drawn at 32 pt and the switch keeps a 44 pt touch target through its hitSlop, no wider than the
// gap to the circle so the two never overlap. From COMPACT_BELOW up the row is as #25 drew it.

import { HUD_CORE } from './model';

const { buttons } = HUD_CORE;

/** Narrower than this (pt), the switch is drawn compact: the 375 pt iPhones (SE, mini, 11 Pro). */
export const COMPACT_BELOW = 390;

/** The least room kept between the row's three groups (TYPE, the centre, STOP). */
export const GROUP_GAP = 8;

/** The switch drawn on a narrow phone: 32 pt, 6 pt of slop on each side (44 pt to touch). */
const COMPACT_SIZE = 32;

export type HudLanguageLayout = Readonly<{
  /** The switch's drawn square, and the empty room on HOLD TO TALK's other side. */
  size: number;
  /** Between the circle and the switch, and between the room and the circle. */
  gap: number;
  /** Added to the switch's touch area on every side. */
  slop: number;
}>;

const FULL: HudLanguageLayout = Object.freeze({
  size: buttons.language.size,
  gap: buttons.language.gap,
  slop: 0,
});

const COMPACT: HudLanguageLayout = Object.freeze({
  size: COMPACT_SIZE,
  gap: buttons.language.gap,
  slop: (buttons.language.size - COMPACT_SIZE) / 2,
});

/** The switch's layout for a window `width` pt wide. */
export function hudLanguageLayout(width: number): HudLanguageLayout {
  return width < COMPACT_BELOW ? COMPACT : FULL;
}

/** The centre group's least width: HOLD TO TALK alone, or with its twin room and the switch. */
export function centreMinWidth(layout: HudLanguageLayout | null): number {
  if (layout === null) return buttons.talk.size;
  return layout.size * 2 + layout.gap * 2 + buttons.talk.size;
}

/** The row's least width at default text size, the padding and GROUP_GAP between groups included. */
export function rowMinWidth(layout: HudLanguageLayout | null): number {
  return buttons.padX * 2 + buttons.side.width * 2 + centreMinWidth(layout) + GROUP_GAP * 2;
}
