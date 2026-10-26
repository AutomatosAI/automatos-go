// The Calendar's paints and sizes, pure (handoff §2 'Calendar', D-ONE-SET): every value the strip,
// the always-on band, the rows and the item sheet draw with is a token key or a named size here, so
// the tab's components only wire and A5 can dress them for Play and HUD in one place. A kind's
// colour is the vendored calendar-kinds.ts tone (data, K14); a kind it does not know is muted. The
// handoff's 9 and 9.5 px mono runs are the 11 pt label (D38); a paused item is drawn at half
// opacity and always carries the word 'Paused' (§4.6).

import type { ColourName, Colours, RadiusName, SpaceName } from '../../styles/tokens';
import { MIN_TOUCH } from '../../ui/paint';
import type { TextLevel, TextTone } from '../../ui/variants';
import type { KindWord } from './day-model';

/** The tab: 14 pt over the strip, 18 in, 28 under the last row, 14 between the blocks. */
export const CALENDAR_LAYOUT = Object.freeze({
  paddingTop: 'space6' as SpaceName,
  paddingX: 'space8' as SpaceName,
  paddingBottom: 'space10' as SpaceName,
  gap: 'space6' as SpaceName,
  /** The pull-to-refresh spinner. */
  spinner: 'mutedForeground' as ColourName,
});

/** The handoff's 50 % for a paused row, band line and sheet head. */
export const PAUSED_OPACITY = 0.5;

/** How opaque an item is drawn: greyed while paused, never hidden. */
export function pausedOpacity(paused: boolean): number {
  return paused ? PAUSED_OPACITY : 1;
}

/** The kind's colour: its vendored tone, or the muted ink for a kind this version does not know. */
export function kindTone(colours: Colours, kind: KindWord): string {
  return kind.tone ?? colours.mutedForeground;
}

/** The kind's square: 8 pt, 2 pt radius, in the kind's colour. */
export const KIND_SQUARE = Object.freeze({
  size: 8,
  radius: 'tag' as RadiusName,
  gap: 'space2' as SpaceName,
});

/** The words beside a kind: 'Paused' muted, 'Overdue' in the accent. */
export const FLAG_TONES: Readonly<Record<'paused' | 'overdue', TextTone>> = Object.freeze({
  paused: 'muted',
  overdue: 'accent',
});

/** The seven-day strip: seven equal cells 4 apart, each 7 over and 6 under, 5 between its lines. */
export const DAY_STRIP = Object.freeze({
  gap: 'space1' as SpaceName,
  paddingTop: 7,
  paddingBottom: 6,
  lineGap: 5,
  radius: 'card' as RadiusName,
  borderWidth: 1,
  weekdayOpacity: 0.75,
  dateLevel: 3 as TextLevel,
  dotSize: 4,
  dotRadius: 'full' as RadiusName,
});

export type StripCellPaint = {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly color: string;
  readonly dot: string;
};

/** The chosen day in solid ink, today on the card, any other day bare; the dot when it has items. */
export function stripCellPaint(
  colours: Colours,
  cell: { readonly selected: boolean; readonly today: boolean; readonly hasItems: boolean },
): StripCellPaint {
  const ground = cell.selected ? colours.foreground : cell.today ? colours.card : 'transparent';
  const border = cell.selected ? colours.foreground : cell.today ? colours.border : 'transparent';
  const dotOn = cell.selected ? colours.card : colours.accent;
  return {
    backgroundColor: ground,
    borderColor: border,
    color: cell.selected ? colours.card : colours.foreground,
    dot: cell.hasItems ? dotOn : 'transparent',
  };
}

/**
 * The always-on band: dashed --border-2, 8 pt radius, 9 × 12 in, a line per heartbeat. Each line
 * opens its item, so it is at least 44 tall (the '24/7' mark stands as tall, beside the first).
 */
export const ALWAYS_ON_BAND = Object.freeze({
  border: 'border2' as ColourName,
  borderWidth: 1,
  borderStyle: 'dashed' as const,
  radius: 'card' as RadiusName,
  paddingY: 9,
  paddingX: 'space5' as SpaceName,
  gap: 'space4' as SpaceName,
  lineGap: 'space3' as SpaceName,
  lineMinHeight: MIN_TOUCH,
  markTone: 'muted' as TextTone,
  titleLevel: 4 as TextLevel,
  everyTone: 'muted' as TextTone,
  everyCase: 'none' as const,
});

/** A row: the mono time in a 40 pt column, then the kind line, the serif title and the meta. */
export const DAY_ROW = Object.freeze({
  gap: 'space5' as SpaceName,
  timeWidth: 40,
  timePaddingTop: 12,
  timeTone: 'muted' as TextTone,
  bodyGap: 4,
  bodyPaddingTop: 10,
  bodyPaddingBottom: 12,
  rule: 'border' as ColourName,
  ruleWidth: 1,
  titleLevel: 5 as TextLevel,
  metaLevel: 6 as TextLevel,
  metaTone: 'muted' as TextTone,
});

/** 'Nothing scheduled this day.': italic serif 15, muted, 24 over and under. */
export const DAY_EMPTY = Object.freeze({
  level: 4 as TextLevel,
  tone: 'muted' as TextTone,
  paddingY: 'space9' as SpaceName,
});

/** The item sheet: the kind line, the serif 23 title, the when line at Body 3, then the actions. */
export const ITEM_SHEET = Object.freeze({
  headGap: 'space4' as SpaceName,
  titleLevel: 2 as TextLevel,
  whenLevel: 3 as TextLevel,
  whenTone: 'muted' as TextTone,
  actionsGap: 'space3' as SpaceName,
  noteLevel: 5 as TextLevel,
  noteTone: 'muted' as TextTone,
  refusalLevel: 3 as TextLevel,
  refusalTone: 'accent' as TextTone,
});
