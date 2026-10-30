// What a style's type answers (styleType in scale.ts): one set of slot names every style resolves,
// so one screen (an edge screen, a Command Centre card) asks for 'screen' or 'card' and each style
// draws it in its own face and size. Play's slots are Ember's phone screens; HUD's are its brand
// line, panel labels and big numbers; Studio answers each with a role of its unchanged scale;
// Arcade's are the handheld's Press Start 2P steps.

import type { TypeStyleKey } from '../../core/frozen/lib/looks/catalogue';
import type { FontWeight } from '../fonts';
import type { HudFontKey } from '../tokens/hud-catalogue';
import type { TypeRole, TypeStyle } from '../type';

/** The display slots, in Ember's names first, then HUD's. */
export const DISPLAY_SLOTS = [
  'hero', // First open's greeting
  'screenLg', // a large screen title
  'screen', // a screen title: 'Chats', Lost's line
  'notRunning', // Not running's title
  'snag', // Something went wrong's card: 'I hit a snag.'
  'status', // Auto's status word beside the mascot
  'header', // a conversation title in a header, a list row's title
  'card', // a report card's title
  'cardSm', // a small card's title
  'lostNumber', // the '404' behind Lost: decorative, hidden from accessibility
  'brand', // the brand line
  'panel', // a panel's header label
  'number', // a big number
] as const;

export type DisplaySlot = (typeof DISPLAY_SLOTS)[number];

/** The title roles a Text title takes (variants.ts textRole): Title 1-6 and the thread's. */
export const TITLE_ROLES = [
  'title1',
  'title2',
  'title3',
  'title4',
  'title5',
  'title6',
  'threadTitle1',
  'threadTitle2',
] as const satisfies readonly TypeRole[];

export type TitleRole = (typeof TITLE_ROLES)[number];

/** What a layout may add to body() or mono(): its own leading, tracking (em) or capitals. */
export type TypeOptions = {
  readonly leading?: number;
  readonly trackingEm?: number;
  readonly uppercase?: boolean;
};

/** A style's type: every value a React Native text style on an embedded face, never below 11. */
export type StyleType = {
  readonly title: (role: TitleRole) => TypeStyle;
  readonly display: (slot: DisplaySlot) => TypeStyle;
  readonly body: (size: number, weight?: FontWeight, options?: TypeOptions) => TypeStyle;
  readonly mono: (size: number, weight?: FontWeight, options?: TypeOptions) => TypeStyle;
  /** Small capitals over a section or a meta line. */
  readonly label: TypeStyle;
  /** The line over a title ('REPORT · JUST NOW'). */
  readonly eyebrow: TypeStyle;
  /** A button's label. */
  readonly button: TypeStyle;
};

/**
 * What styleType reads of a resolved style: the layout it paints and, for Play and HUD, the look's
 * font knob (Arcade's looks have none). An installed theme paints the Studio layout (D58).
 */
export type TypeSource =
  | { readonly layout: 'studio' }
  | { readonly layout: 'play'; readonly font: TypeStyleKey }
  | { readonly layout: 'hud'; readonly font: HudFontKey }
  | { readonly layout: 'arcade' };
