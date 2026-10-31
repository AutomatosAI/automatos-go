// Candy's floating tab bar, pure (CANDY-LAYOUT §4; P1, P3 and P4 at 390 × 844; the kit's
// frame/tab-bar.tsx and phone.module.css at 3920359d5): a pill 18 pt from each side and 22 pt above
// the bottom inset, 72 tall, in five columns 1fr 1fr 76 1fr 1fr — Today, Chat, the voice control
// raised 18 pt in a 64 pt white surround with a 3 pt accent ring, Shelf, Team. Each tab is a 56 pt
// circle with a 10 pt dot (its card set's start colour: 1, 2, 3, 1) over its 12 pt / 800 word; the
// view on screen fills with the accent, its dot and word in the accent's ink.
//
// Dynamic Type (D-A11Y; the D-pad's lesson, A8 P001A-RVW-2): a tab grows with the text size up to
// its column and never past it, its word wraps, and a word that wraps makes the tab taller, so the
// bar grows taller and never wider; every tab stays at least 44 pt each way. Pure: no React, React
// Native, Expo or Skia.

import { CARD_START_VARS, type CandyVarName } from '../../tokens/candy';
import { CANDY_LEADING, CANDY_STEPS } from '../../typeface/candy-type';
import type { CardSet } from '../sets';

export const CANDY_TABS = Object.freeze(['today', 'chat', 'shelf', 'team'] as const);
export type CandyTab = (typeof CANDY_TABS)[number];

/** The kit's TABS: each tab's dot in a card set's start colour. */
export const TAB_DOT_SET: Readonly<Record<CandyTab, CardSet>> = Object.freeze({
  today: 1,
  chat: 2,
  shelf: 3,
  team: 1,
});

/** The design's measures, in points. */
export const TAB_BAR = Object.freeze({
  /** From each side of the screen, and above the bottom inset. */
  side: 18,
  bottom: 22,
  /** The bar at the default text size, and its padding round the tabs. */
  height: 72,
  padH: 8,
  padV: 8,
  /** The voice's column. */
  centre: 76,
  /** A tab: its circle, its dot, the gap under the dot, and room above and below its content. */
  item: 56,
  dot: 10,
  gap: 3,
  itemPadV: 6,
  /** The voice's surround: its disc, its accent ring and how far it is raised. */
  voice: 64,
  ring: 3,
  raise: 18,
  /** Apple's touch target. */
  target: 44,
});

/** The phone the design draws, for a width that is not a number. */
const REFERENCE_WIDTH = 390;
const TAB_COLUMNS = 4;

export type TabBarMetrics = {
  /** The bar's width: the screen less 18 pt each side, the same at every text size. */
  readonly barWidth: number;
  /** Each tab's column. */
  readonly column: number;
  /** A tab: as wide as `width`, at least `minHeight` tall (a circle until its word needs more). */
  readonly item: { readonly width: number; readonly minHeight: number; readonly radius: number };
  /** The bar's least height: 72, or its tallest tab and the padding. */
  readonly barMinHeight: number;
};

/** One line of the tab's word at this text size. */
function labelLine(scale: number): number {
  return CANDY_STEPS.tab * scale * CANDY_LEADING.label;
}

/** The bar's measures at this text size on a screen this wide. */
export function tabBarMetrics(fontScale: number, width: number): TabBarMetrics {
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const grow = Math.max(1, scale);
  const barWidth = (Number.isFinite(width) ? width : REFERENCE_WIDTH) - TAB_BAR.side * 2;
  const column = (barWidth - TAB_BAR.padH * 2 - TAB_BAR.centre) / TAB_COLUMNS;
  const grown = Math.max(TAB_BAR.item, Math.round(TAB_BAR.item * grow));
  const itemWidth = Math.max(TAB_BAR.target, Math.min(Math.floor(column), grown));
  const content = TAB_BAR.dot + TAB_BAR.gap + labelLine(scale) + TAB_BAR.itemPadV * 2;
  const minHeight = Math.max(itemWidth, Math.ceil(content));
  return Object.freeze({
    barWidth,
    column,
    item: Object.freeze({ width: itemWidth, minHeight, radius: itemWidth / 2 }),
    barMinHeight: Math.max(TAB_BAR.height, minHeight + TAB_BAR.padV * 2),
  });
}

/** The surround's outer side: the 64 pt disc and its ring. */
export const VOICE_SURROUND = TAB_BAR.voice + TAB_BAR.ring * 2;

/**
 * How far the raised voice stands over the bar's top (17 pt at 72): the bar keeps this much room
 * above its pill, so the voice lies inside the bar's own box and every point of it takes a touch.
 */
export function voiceOver(metrics: TabBarMetrics): number {
  return Math.max(0, TAB_BAR.raise + VOICE_SURROUND / 2 - metrics.barMinHeight / 2);
}

/**
 * The least room the bar takes from the screen's foot (the bottom inset, the 22 pt, the bar and the
 * raised voice over it): a view under it pads its content's foot by this much.
 */
export function tabBarSpace(metrics: TabBarMetrics, insetBottom: number): number {
  return insetBottom + TAB_BAR.bottom + metrics.barMinHeight + voiceOver(metrics);
}

/** A tab's paint as the palette's variable names: the view on screen in the accent, the rest on the bar. */
export type TabPaint = {
  readonly fill: CandyVarName | null;
  readonly ink: CandyVarName;
  readonly dot: CandyVarName;
};

export function tabPaint(tab: CandyTab, active: CandyTab | null): TabPaint {
  if (tab === active) return Object.freeze({ fill: 'accent', ink: 'accentInk', dot: 'accentInk' });
  return Object.freeze({ fill: null, ink: 'text', dot: CARD_START_VARS[TAB_DOT_SET[tab]] });
}
