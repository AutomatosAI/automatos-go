// Play's type on the phone (Ember, PRD-001 §4.6): the display slots of Ember's 390 pt screens at
// the Editorial look (Instrument Serif), and for Clean, Characterful and Playful each slot scaled by
// the web's own ratio, TYPE_STYLES[font].sizes / TYPE_STYLES.serif.sizes (hero, screen*, notRunning
// and lostNumber by hero; status and snag by status; header by brand; card* by card), rounded to
// whole points.
// Instrument Serif is never drawn below 19 pt (Ember README), and a title takes the display face
// only at 19 and above: anything smaller falls to Geist 600, the Clean face. Text is Geist (16/1.6
// in the thread, 15/1.5 in bubbles), buttons Geist 600 14, labels Geist 500 11 caps at .14em
// (Ember draws some at 10: D38 raises them to 11), mono Geist Mono 12-13.

import { TYPE_STYLES, type TypeSizes, type TypeStyleKey } from '../../core/frozen/lib/looks/catalogue';
import { FONT_FAMILIES, type FontWeight } from '../fonts';
import { LEADING, TYPE_SPECS, type TypeStyle } from '../type';
import { STYLE_FACES, playDisplayFace, type FaceSpec } from './faces';
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

/** Ember README: Instrument Serif is for display only, never below 19 px. */
export const PLAY_DISPLAY_MIN = 19;

type PlaySlot = Exclude<DisplaySlot, 'brand' | 'panel' | 'number'>;

export type SlotSize = {
  readonly size: number;
  readonly leading: number;
  /** The web's display size whose ratio scales this slot for a non-serif look. */
  readonly ratio: keyof TypeSizes;
};

const slot = (size: number, leading: number, ratio: keyof TypeSizes): SlotSize =>
  Object.freeze({ size, leading, ratio });

/** Ember's phone slots at the Editorial look ('Automatos Play Ember.dc.html', 390 pt screens). */
export const PLAY_SLOTS: Readonly<Record<PlaySlot, SlotSize>> = Object.freeze({
  hero: slot(58, 0.92, 'hero'), // 06 First open
  screenLg: slot(48, 0.9, 'hero'),
  screen: slot(44, 0.95, 'hero'), // 03 'Chats', 09 Lost
  notRunning: slot(52, 0.92, 'hero'), // 07 Not running
  snag: slot(28, 1, 'status'), // 08 'I hit a snag.'
  status: slot(26, 1, 'status'), // Auto's status word
  header: slot(22, 1.1, 'brand'), // the chat's title, a conversation row (Ember's 22px/1.1)
  card: slot(24, 1, 'card'), // 02 the report card
  cardSm: slot(19, 1, 'card'),
  lostNumber: slot(200, 0.8, 'hero'), // 09 the '404' behind, decorative
});

/** Play's brand line is its header; its big numbers its status size. */
const SLOT_ALIASES: Readonly<Record<'brand' | 'number', PlaySlot>> = Object.freeze({
  brand: 'header',
  number: 'status',
});

const PLAY_TYPE = Object.freeze({
  threadSize: 16,
  threadLeading: 1.6,
  textLeading: LEADING.body,
  labelSize: 11,
  labelWeight: 500 as FontWeight,
  labelTracking: 0.14,
  buttonSize: 14,
  buttonWeight: 600 as FontWeight,
});

/** A slot's size for the look's font: the Editorial size, else scaled by the web's ratio. */
export function playSlotSize(font: TypeStyleKey, name: PlaySlot): number {
  const { size, ratio } = PLAY_SLOTS[name];
  if (font === 'serif') return size;
  return Math.round((size * TYPE_STYLES[font].sizes[ratio]) / TYPE_STYLES.serif.sizes[ratio]);
}

type Face = { readonly face: FaceSpec; readonly tracking: number };

const fallback = (): Face => ({
  face: playDisplayFace('clean'),
  tracking: parseEm(TYPE_STYLES.clean.letterSpacing),
});

const lookFace = (font: TypeStyleKey): Face => ({
  face: playDisplayFace(font),
  tracking: parseEm(TYPE_STYLES[font].letterSpacing),
});

/** The look's display face, except Instrument Serif below 19 pt. */
function displayFace(font: TypeStyleKey, size: number): Face {
  const face = lookFace(font);
  const tooSmall = face.face.family === FONT_FAMILIES.instrumentSerif && size < PLAY_DISPLAY_MIN;
  return tooSmall ? fallback() : face;
}

function label(): TypeStyle {
  return roleStyle(
    STYLE_FACES.play.body,
    PLAY_TYPE.labelSize,
    PLAY_TYPE.labelWeight,
    { leading: LEADING.heading },
    { trackingEm: PLAY_TYPE.labelTracking, uppercase: true },
  );
}

/**
 * A display slot at another size (a printed sheet's title on the Shelf): the slot's leading, the
 * look's display face through the same under-19 rule, never below 11 (textStyle's floor).
 */
export function playDisplayAt(font: TypeStyleKey, name: PlaySlot, size: number): TypeStyle {
  const { face, tracking } = displayFace(font, size);
  return textStyle({ face, size, leading: PLAY_SLOTS[name].leading, tracking });
}

function display(font: TypeStyleKey, name: DisplaySlot): TypeStyle {
  if (name === 'panel') return label();
  const resolved = name === 'brand' || name === 'number' ? SLOT_ALIASES[name] : name;
  return playDisplayAt(font, resolved, playSlotSize(font, resolved));
}

function title(font: TypeStyleKey, role: TitleRole): TypeStyle {
  const { size, leading } = TYPE_SPECS[role];
  const { face, tracking } = size >= PLAY_DISPLAY_MIN ? lookFace(font) : fallback();
  return textStyle({ face, size, leading, tracking });
}

function body(size: number, weight: FontWeight = 400, options?: TypeOptions): TypeStyle {
  const leading = size === PLAY_TYPE.threadSize ? PLAY_TYPE.threadLeading : PLAY_TYPE.textLeading;
  return roleStyle(STYLE_FACES.play.body, size, weight, { leading }, options);
}

function mono(size: number, weight: FontWeight = 400, options?: TypeOptions): TypeStyle {
  return roleStyle(STYLE_FACES.play.mono, size, weight, { leading: LEADING.body }, options);
}

export function playType(font: TypeStyleKey): StyleType {
  const caps = label();
  return Object.freeze({
    title: styleTable(TITLE_ROLES, (role) => title(font, role)),
    display: styleTable(DISPLAY_SLOTS, (name) => display(font, name)),
    body,
    mono,
    label: caps,
    eyebrow: caps,
    button: roleStyle(STYLE_FACES.play.body, PLAY_TYPE.buttonSize, PLAY_TYPE.buttonWeight, {
      leading: LEADING.heading,
    }),
  });
}
