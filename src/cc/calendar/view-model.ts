// The Calendar tab's view, pure (handoff §2 'Calendar', D-PAUSE): the day model (day-model.ts) as
// the strip's cells, the always-on band's lines and the chosen day's rows draw them, with the words
// VoiceOver hears. A paused item keeps its row with the word 'Paused' beside its kind (and is
// greyed, chrome.ts); an overdue deadline says 'Overdue', and one missed before today says the day
// it was due. The figure on the Calendar tab is today's rows (the band is every day's, uncounted).

import { joinLabel } from '../../ui/paint';
import { countPhrase } from '../../ui/variants';
import { CALENDAR_COPY } from '../strings';
import {
  dayModel,
  type BandItem,
  type CalendarRow,
  type DayModel,
  type DayModelInput,
  type KindWord,
  type StripDay,
} from './day-model';

/** A word beside an item's kind (every colour status has a word, §4.6). */
export type ItemFlag = { readonly key: 'paused' | 'overdue'; readonly word: string };

export type StripCellView = StripDay & {
  readonly selected: boolean;
  /** 'Fri 23 Oct'. */
  readonly dateLabel: string;
  /** 'Fri 23 Oct, today, 3 items'. */
  readonly accessibilityLabel: string;
};

export type RowView = {
  readonly key: string;
  readonly itemId: string;
  /** '09:00', or the dash for an item the server sent no time for. */
  readonly time: string;
  readonly kind: KindWord;
  readonly flags: readonly ItemFlag[];
  readonly title: string;
  /** 'Due Tue 20 Oct · Ledger'; null when there is nothing to say. */
  readonly meta: string | null;
  readonly paused: boolean;
  readonly accessibilityLabel: string;
};

export type BandLineView = {
  readonly itemId: string;
  readonly kind: KindWord;
  /** 'Relay · Inbox triage'. */
  readonly line: string;
  /** 'every 15 min'. */
  readonly every: string;
  readonly flags: readonly ItemFlag[];
  readonly paused: boolean;
  readonly accessibilityLabel: string;
};

export type CalendarView = {
  readonly selected: string;
  readonly selectedDay: StripCellView;
  readonly strip: readonly StripCellView[];
  readonly band: readonly BandLineView[];
  readonly rows: readonly RowView[];
  /** 'Nothing scheduled this day.' when the chosen day has no rows. */
  readonly empty: string | null;
};

const SEPARATOR = ` ${CALENDAR_COPY.separator} `;

/** 'Fri 23 Oct'. */
export function dayLabel(day: Pick<StripDay, 'weekday' | 'day' | 'month'>): string {
  return `${day.weekday} ${day.day} ${day.month}`;
}

function stripCell(day: StripDay, selected: string): StripCellView {
  const dateLabel = dayLabel(day);
  const figure = day.hasItems
    ? countPhrase(day.count, CALENDAR_COPY.items)
    : CALENDAR_COPY.nothingOn;
  return {
    ...day,
    selected: day.key === selected,
    dateLabel,
    accessibilityLabel: joinLabel(dateLabel, day.today ? CALENDAR_COPY.today : null, figure),
  };
}

function flagsOf(item: { readonly paused: boolean; readonly overdue?: boolean }): ItemFlag[] {
  return [
    ...(item.paused ? [{ key: 'paused' as const, word: CALENDAR_COPY.paused }] : []),
    ...(item.overdue ? [{ key: 'overdue' as const, word: CALENDAR_COPY.overdue }] : []),
  ];
}

function rowMeta(row: CalendarRow): string | null {
  const parts = [row.dueOn ? CALENDAR_COPY.dueOn(row.dueOn) : null, row.meta].filter(Boolean);
  return parts.length > 0 ? parts.join(SEPARATOR) : null;
}

/** A row of the chosen day: the time, the kind with its words, the title and the meta. */
export function rowView(row: CalendarRow): RowView {
  const flags = flagsOf(row);
  const meta = rowMeta(row);
  return {
    key: row.key,
    itemId: row.itemId,
    time: row.time ?? CALENDAR_COPY.noTime,
    kind: row.kind,
    flags,
    title: row.title,
    meta,
    paused: row.paused,
    accessibilityLabel: joinLabel(
      row.time ?? CALENDAR_COPY.noTimeSaid,
      row.kind.label,
      ...flags.map((flag) => flag.word),
      row.title,
      meta,
    ),
  };
}

/** A heartbeat in the band: 'Relay · Inbox triage', every 15 min. */
export function bandLineView(band: BandItem): BandLineView {
  const line = [band.agent, band.title].filter(Boolean).join(SEPARATOR);
  const flags = flagsOf(band);
  return {
    itemId: band.itemId,
    kind: band.kind,
    line,
    every: band.every,
    flags,
    paused: band.paused,
    accessibilityLabel: joinLabel(
      CALENDAR_COPY.bandLabel,
      band.kind.label,
      ...flags.map((flag) => flag.word),
      line,
      band.every,
    ),
  };
}

export function calendarView(model: DayModel): CalendarView {
  const strip = model.strip.map((day) => stripCell(day, model.selected));
  const selectedDay = strip.find((cell) => cell.selected) ?? strip[0];
  return {
    selected: model.selected,
    selectedDay,
    strip,
    band: model.band.map(bandLineView),
    rows: model.rows.map(rowView),
    empty: model.rows.length === 0 ? CALENDAR_COPY.empty : null,
  };
}

/** The Calendar tab's figure: how many rows today has (the band is uncounted). */
export function todayCount(input: Omit<DayModelInput, 'selected'>): number {
  return dayModel(input).strip[0]?.count ?? 0;
}
