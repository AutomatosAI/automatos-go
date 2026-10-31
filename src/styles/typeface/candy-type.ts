// Candy's type on the phone (the handoff's README 'Type' and automatos-go/CANDY-LAYOUT.md, the
// 390 pt frames P1-P4 in 'Automatos Candy.dc.html', the design kit's themes/candy at 3920359d5):
// Outfit 600 for titles and figures, its 700 for the orb's figure; Nunito 400 for running text, 700
// for labels and meta, 800 for buttons, card labels and the tab label; Geist Mono for code (the kit
// leaves code in the host's face). The design's steps: a view's title 30 ('Deliverables', 'Your
// team'), the greeting 28, a section 20 (the Command Centre's and the sheets' titles), a card's or
// the chat's title 17; the orb's figure 60 and a stat card's 34. Running text: a message 14 at 1.45
// (Auto's bubble), body 15; labels 14 and meta 13; buttons and card labels 13, the tab label 12.
// D-A11Y: none of Candy's own steps is under 12 (CANDY_MIN: the design's 10 and 11 px labels are
// 12), so body() and mono() never answer under it either. The frames set a view's title at /1; a
// title that wraps under Dynamic Type keeps the greeting's 1.1, so a line's descenders clear the
// next line's capitals (Outfit: ascent 1, descent .26 em). No tracking: the phone frames set none.

import type { FontWeight } from '../fonts';
import { LEADING, type TypeStyle } from '../type';
import { STYLE_FACES, pickFace, type FaceSpec } from './faces';
import { roleStyle, styleTable, textStyle, type TextSpec } from './text-style';
import {
  DISPLAY_SLOTS,
  TITLE_ROLES,
  type DisplaySlot,
  type StyleType,
  type TitleRole,
  type TypeOptions,
} from './types';

/** D-A11Y: Candy's smallest text, a step over D38's MIN_TEXT_SIZE. */
export const CANDY_MIN = 12;

/** The design's steps (pt), by face and weight. */
export const CANDY_STEPS = Object.freeze({
  view: 30, // Outfit 600: a view's title
  greeting: 28, // Outfit 600: Today's greeting
  section: 20, // Outfit 600: a section's title
  card: 17, // Outfit 600: a card's title, the chat's title
  orb: 60, // Outfit 700: the orb's figure
  stat: 34, // Outfit 600: a stat card's figure
  body: 15, // Nunito 400: body
  message: 14, // Nunito 400: a message
  label: 14, // Nunito 700: a label ('3 things need you')
  meta: 13, // Nunito 700: meta
  button: 13, // Nunito 800: a button's label
  cardLabel: 13, // Nunito 800: a card's label ('Working now')
  tab: 12, // Nunito 800: the tab bar's label
});

/** Each step's leading: the frames' and the kit's, a title's raised to 1.1 (see above). */
export const CANDY_LEADING = Object.freeze({
  title: 1.1, // a view's title and the greeting (28/1.1)
  heading: 1.2, // a section, a card, the chat's title (the kit's 17/1.2 and 20/1.2)
  figure: 1.05, // a stat card's 34/1.05 and the orb's figure
  text: 1.45, // running text (Auto's bubble 14/1.45, the kit's body 15/1.45)
  label: 1.3, // labels, meta, buttons, card labels and the tab (the kit's 13/1.3 and 12/1.3)
});

/**
 * Lost's '404', decorative and hidden from accessibility (Candy's own 404 is Auto lost, no figure):
 * Outfit 600's '4', '0' and '4' are 1.868 em, so 336 pt at 180, inside a 390 pt screen's 16 pt
 * gutters (358).
 */
export const CANDY_LOST_NUMBER = Object.freeze({ size: 180, leading: 0.8 });

const TITLE_FACE: FaceSpec = STYLE_FACES.candy.display.title;
const FIGURE_FACE: FaceSpec = STYLE_FACES.candy.display.figure;

const outfit = (size: number, leading: number, face: FaceSpec = TITLE_FACE): TextSpec =>
  Object.freeze({ face, size, leading, tracking: 0 });

const nunito = (size: number, weight: FontWeight): TextSpec =>
  Object.freeze({
    face: pickFace(STYLE_FACES.candy.body, weight),
    size,
    leading: CANDY_LEADING.label,
    tracking: 0,
  });

const view = outfit(CANDY_STEPS.view, CANDY_LEADING.title);
const greeting = outfit(CANDY_STEPS.greeting, CANDY_LEADING.title);
const section = outfit(CANDY_STEPS.section, CANDY_LEADING.heading);
const card = outfit(CANDY_STEPS.card, CANDY_LEADING.heading);
const cardLabel = nunito(CANDY_STEPS.cardLabel, 800);

/** Each display slot; the comments name where the design draws it. */
export const CANDY_SLOTS: Readonly<Record<DisplaySlot, TextSpec>> = Object.freeze({
  hero: greeting, // First open's greeting, as Today's 'Hi, …'
  screenLg: view,
  screen: view, // a view's title: 'Deliverables', 'Your team'
  notRunning: view,
  snag: section, // a window's title
  status: cardLabel, // Auto's state word in its pill ('● Listening', the kit's 800 13)
  header: card, // the chat's title on the stage, a conversation's title
  card, // a card's title: 'Needs you'
  cardSm: cardLabel, // a tile's title on the shelf (13/800)
  lostNumber: outfit(CANDY_LOST_NUMBER.size, CANDY_LOST_NUMBER.leading),
  brand: section,
  panel: cardLabel, // a window's or a stat card's label ('Working now')
  number: outfit(CANDY_STEPS.stat, CANDY_LEADING.figure), // a stat card's figure
});

/** Studio's title roles: Title 1 a view's title, 2 the greeting, 3 a section, the rest a card. */
export const CANDY_TITLES: Readonly<Record<TitleRole, TextSpec>> = Object.freeze({
  title1: view,
  title2: greeting,
  title3: section,
  title4: card,
  title5: card,
  title6: card,
  threadTitle1: section,
  threadTitle2: card,
});

function body(size: number, weight: FontWeight = 400, options?: TypeOptions): TypeStyle {
  const shown = Math.max(size, CANDY_MIN);
  return roleStyle(STYLE_FACES.candy.body, shown, weight, { leading: CANDY_LEADING.text }, options);
}

function mono(size: number, weight: FontWeight = 400, options?: TypeOptions): TypeStyle {
  const shown = Math.max(size, CANDY_MIN);
  return roleStyle(STYLE_FACES.candy.mono, shown, weight, { leading: LEADING.body }, options);
}

/** The orb's figure: Outfit 700 at 60/1.05 (CANDY-LAYOUT §3, Today's orb). */
export function candyOrbFigure(): TypeStyle {
  return textStyle(outfit(CANDY_STEPS.orb, CANDY_LEADING.figure, FIGURE_FACE));
}

/** An avatar's initial: Outfit 600 at the size it is given (0.4 of the face, parts/avatar-model.ts), set solid. */
export function candyAvatarInitial(size: number): TypeStyle {
  return textStyle(outfit(Math.max(size, CANDY_MIN), 1));
}

/** The tab bar's label: Nunito 800 at 12, at a leading that lets it wrap (the bar grows taller). */
export function candyTabLabel(): TypeStyle {
  return textStyle(nunito(CANDY_STEPS.tab, 800));
}

/** Candy's StyleType: Outfit titles and figures over Nunito labels and running text. */
export function candyType(): StyleType {
  return Object.freeze({
    title: styleTable(TITLE_ROLES, (role) => textStyle(CANDY_TITLES[role])),
    display: styleTable(DISPLAY_SLOTS, (slot) => textStyle(CANDY_SLOTS[slot])),
    body,
    mono,
    label: textStyle(nunito(CANDY_STEPS.label, 700)),
    eyebrow: textStyle(nunito(CANDY_STEPS.meta, 700)),
    button: textStyle(nunito(CANDY_STEPS.button, 800)),
  });
}
