// Arcade's type on the phone (README 'Type', the design kit's handheld at 034fa629c and the
// 'Phone 390' handheld in 'Automatos Arcade.dc.html'): Press Start 2P for titles, labels, counters,
// eyebrows and buttons, Pixelify Sans for all running text, Geist Mono for code (the kit leaves
// code in the host's face). The design sets Press Start 2P at 8, 10, 12 or 16 px (the handheld's
// smallest words at 7 to 9). The face is wide, every glyph a full em, and D38 floors the phone at
// 11, so on the phone its steps are: labels 11 (the web's 7-10 px labels, eyebrows, the brand line
// and Auto's state word, in capitals), buttons 12 (the web's 10 px, a step over the labels), titles
// 14 (the web's 12 px window titles) and headings 16 (the wordmark's 16 px). Titles and labels keep
// the kit's 1.6 leading and their tracking (ui.module.css .title and .label, .1em). Running text is
// Pixelify Sans at the size asked, never under the design's 15 px, at a window's 1.35 leading; the
// handheld's dialogue line is 17/1.3.

import type { FontWeight } from '../fonts';
import { LEADING, MIN_TEXT_SIZE, type TypeStyle } from '../type';
import { STYLE_FACES, type FaceSpec } from './faces';
import { roleStyle, styleTable, textStyle, type TextSpec } from './text-style';
import {
  DISPLAY_SLOTS,
  TITLE_ROLES,
  type DisplaySlot,
  type StyleType,
  type TitleRole,
  type TypeOptions,
} from './types';

/** Press Start 2P's steps on the phone (pt): the design's 8, 10, 12 and 16 px over D38's floor. */
export const ARCADE_STEPS = Object.freeze({
  label: MIN_TEXT_SIZE,
  button: 12,
  title: 14,
  heading: 16,
});

/** README 'Type': Pixelify Sans for all running text, at 15 to 25 px. */
export const ARCADE_BODY_MIN = 15;

/** The handheld's dialogue: Auto's typed line at 17/1.3 (dialogue.module.css, the phone). */
export const ARCADE_DIALOGUE = Object.freeze({ size: 17, leading: 1.3 });

/**
 * The D-pad's word under its arrow (▲ Quests …): Pixelify Sans at D38's 11 with the pad's 1.1
 * leading (handheld.module.css .pad). The design's 13 px does not fit 'Inventory' (5.17 em in
 * Pixelify Sans Regular) inside a 64 pt cell's 60 pt between its borders (arcade/parts/pad-grid.ts).
 */
export const ARCADE_PAD_WORD = Object.freeze({ size: MIN_TEXT_SIZE, leading: 1.1 });

/**
 * Lost's '404', decorative: three full-em glyphs inside a 390 pt screen's 16 pt gutters (3 × 112 =
 * 336), on the face's 8-unit pixel grid.
 */
export const ARCADE_LOST_NUMBER = Object.freeze({ size: 112, leading: 1, tracking: 0 });

const ARCADE_TYPE = Object.freeze({
  pixelLeading: 1.6, // ui.module.css .title and .label
  titleTracking: 0.1, // .title
  labelTracking: 0.1, // .label
  eyebrowTracking: 0.12, // the handheld's menu heads and POWER
  brandTracking: 0.14, // 'AUTOMATOS ARCADE' under the screen
  stateTracking: 0.08, // Auto's state word under the sprite
  buttonLeading: 1.4, // .button
  textLeading: 1.35, // a window's text (.window)
});

type PixelText = Omit<TextSpec, 'face'>;

const pixel = (size: number, leading: number, tracking: number): PixelText =>
  Object.freeze({ size, leading, tracking });

const caps = (size: number, leading: number, tracking: number): PixelText =>
  Object.freeze({ size, leading, tracking, uppercase: true });

const heading = pixel(ARCADE_STEPS.heading, ARCADE_TYPE.pixelLeading, ARCADE_TYPE.titleTracking);
const title = pixel(ARCADE_STEPS.title, ARCADE_TYPE.pixelLeading, ARCADE_TYPE.titleTracking);
const label = (tracking: number) => caps(ARCADE_STEPS.label, ARCADE_TYPE.pixelLeading, tracking);

/** Each display slot in Press Start 2P; the comments name where the design draws it. */
export const ARCADE_SLOTS: Readonly<Record<DisplaySlot, PixelText>> = Object.freeze({
  hero: heading, // First open's greeting: the wordmark's 16
  screenLg: heading,
  screen: heading, // a screen title: 'OPTIONS', the empty map's line
  notRunning: heading,
  snag: title, // a window's title (12 px on the web)
  status: label(ARCADE_TYPE.stateTracking), // Auto's state word (8 px, .08em)
  header: title, // a quest's or a conversation's title in a header
  card: title,
  cardSm: title,
  lostNumber: ARCADE_LOST_NUMBER,
  brand: label(ARCADE_TYPE.brandTracking), // 'AUTOMATOS ARCADE' (8 px, .14em)
  panel: label(ARCADE_TYPE.labelTracking), // a window's label ('WORLD MAP · 3', 'PARTY')
  number: pixel(ARCADE_STEPS.heading, LEADING.heading, 0), // a counter's number (XP, !, QUEST)
});

/** Studio's title roles: the large ones and an answer's h1 as headings, the rest as titles. */
export const ARCADE_TITLES: Readonly<Record<TitleRole, PixelText>> = Object.freeze({
  title1: heading,
  title2: heading,
  title3: heading,
  title4: title,
  title5: title,
  title6: title,
  threadTitle1: heading,
  threadTitle2: title,
});

const PIXEL_FACE: FaceSpec = STYLE_FACES.arcade.display.pixel;

const onPixel = (text: PixelText): TypeStyle => textStyle({ face: PIXEL_FACE, ...text });

function body(size: number, weight: FontWeight = 400, options?: TypeOptions): TypeStyle {
  const shown = Math.max(size, ARCADE_BODY_MIN);
  const leading =
    shown === ARCADE_DIALOGUE.size ? ARCADE_DIALOGUE.leading : ARCADE_TYPE.textLeading;
  return roleStyle(STYLE_FACES.arcade.body, shown, weight, { leading }, options);
}

function mono(size: number, weight: FontWeight = 400, options?: TypeOptions): TypeStyle {
  return roleStyle(STYLE_FACES.arcade.mono, size, weight, { leading: LEADING.body }, options);
}

/** The D-pad's word (ARCADE_PAD_WORD): Arcade's only running-text face under ARCADE_BODY_MIN. */
export function arcadePadWord(): TypeStyle {
  return roleStyle(STYLE_FACES.arcade.body, ARCADE_PAD_WORD.size, 400, {
    leading: ARCADE_PAD_WORD.leading,
  });
}

/** Arcade's StyleType; Press Start 2P has one weight, so every pixel slot is its 400. */
export function arcadeType(): StyleType {
  return Object.freeze({
    title: styleTable(TITLE_ROLES, (role) => onPixel(ARCADE_TITLES[role])),
    display: styleTable(DISPLAY_SLOTS, (slot) => onPixel(ARCADE_SLOTS[slot])),
    body,
    mono,
    label: onPixel(label(ARCADE_TYPE.labelTracking)),
    eyebrow: onPixel(label(ARCADE_TYPE.eyebrowTracking)),
    button: onPixel(caps(ARCADE_STEPS.button, ARCADE_TYPE.buttonLeading, 0)),
  });
}
