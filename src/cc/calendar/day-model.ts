// The Calendar's day view, pure (handoff §2: the phone is the Day view): the seven-day strip from
// today (a dot on a day with items), the always-on band (heartbeats every hour or faster, dashed),
// and the chosen day's rows in time order, all in the phone's timezone (expo-localization's zone is
// passed in, never a fixed one). Kind words and colours are the vendored calendar-kinds.ts (data,
// K14); a kind outside the six keeps its own word and no colour. A paused item stays listed and
// greyed (PRD-266 §4.9). A deadline that has passed is overdue, and one missed before today is
// listed today with the day it was due; any other run before today is not on the strip. The band
// is every day's, so it puts no dot on a day.

import { isDeadlineItem } from '../../core/web/components/command-center/calendar-actions';
import {
  KIND_META,
  KIND_ORDER,
  type ScheduleItemType,
} from '../../core/web/components/command-center/calendar-kinds';
import { humanised } from '../board/board';
import { CALENDAR_COPY, SHELL_COPY } from '../strings';
import { cadenceWord, everyWord } from './cadence';
import { instantOf, intervalOf, isAlwaysOn, occurrencesOf, type Span } from './occurrences';
import type { ScheduleEntry } from './schemas';
import { addDays, clockText, dayKeyOf, zonedTime, type CalendarDate } from './zone';

/** The strip: today and the six days after it, as the feed's range=7d covers. */
export const STRIP_DAYS = 7;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Wide enough to hold today's midnight and the strip's last night in any zone, clock change too. */
const SPAN_MARGIN_MS = 2 * HOUR_MS;

/** What an item is, as the calendar words and colours it; tone is null for a kind it does not know. */
export type KindWord = {
  readonly type: string;
  readonly label: string;
  readonly tone: string | null;
};

export type StripDay = {
  readonly key: string;
  /** 'Thu', '22', 'Oct': the cell's words. */
  readonly weekday: string;
  readonly day: number;
  readonly month: string;
  readonly today: boolean;
  /** How many rows the day has (today's is the Calendar tab's figure). */
  readonly count: number;
  /** The dot. */
  readonly hasItems: boolean;
};

export type CalendarRow = {
  /** Unique on the day: the item and the run. */
  readonly key: string;
  /** The feed item behind the row: the item sheet acts on it. */
  readonly itemId: string;
  /** The day it is listed on. */
  readonly day: string;
  readonly at: number | null;
  /** '09:00' on the phone's clock; null for an item the server sent no time for. */
  readonly time: string | null;
  /** 'Tue 20 Oct' for an overdue deadline listed today; null otherwise. */
  readonly dueOn: string | null;
  readonly kind: KindWord;
  readonly title: string;
  /** 'Ledger · weekdays'; null when there is neither. */
  readonly meta: string | null;
  /** Greyed, and still listed. */
  readonly paused: boolean;
  readonly overdue: boolean;
};

export type BandItem = {
  readonly itemId: string;
  readonly kind: KindWord;
  readonly title: string;
  readonly agent: string | null;
  /** 'every 15 min'. */
  readonly every: string;
  readonly paused: boolean;
};

export type DayModel = {
  readonly today: string;
  /** The day shown: the one asked for while it is on the strip, else today. */
  readonly selected: string;
  readonly strip: readonly StripDay[];
  readonly rows: readonly CalendarRow[];
  readonly band: readonly BandItem[];
};

export type DayModelInput = {
  readonly items: readonly ScheduleEntry[];
  readonly now: Date;
  /** The phone's IANA zone; null reads the phone's own clock. */
  readonly timeZone: string | null;
  readonly selected?: string | null;
};

type Context = {
  readonly now: number;
  readonly timeZone: string | null;
  readonly today: string;
  readonly days: ReadonlySet<string>;
};

const KNOWN_KINDS: ReadonlySet<string> = new Set(KIND_ORDER);

function isKnownKind(type: string): type is ScheduleItemType {
  return KNOWN_KINDS.has(type);
}

/** The kind's word and colour (calendar-kinds.ts); one it does not know reads as itself. */
export function kindWord(type: string): KindWord {
  if (isKnownKind(type)) return { type, label: KIND_META[type].label, tone: KIND_META[type].tone };
  return { type, label: humanised(type) || CALENDAR_COPY.otherKind, tone: null };
}

/** A mission's or a ticket's deadline: a due time, not a run (calendar-actions.ts). */
export function isDeadline(item: Pick<ScheduleEntry, 'type'>): boolean {
  return isKnownKind(item.type) && isDeadlineItem({ type: item.type });
}

function titleOf(item: ScheduleEntry): string {
  return item.name.trim() || CALENDAR_COPY.untitled;
}

function metaOf(item: ScheduleEntry): string | null {
  const parts = [item.agent_name?.trim(), cadenceWord(item)].filter(Boolean);
  return parts.length > 0 ? parts.join(` ${CALENDAR_COPY.separator} `) : null;
}

function dateWord(date: { weekday: number; day: number; month: number }): string {
  return `${SHELL_COPY.weekdays[date.weekday]} ${date.day} ${SHELL_COPY.months[date.month]}`;
}

function rowOf(item: ScheduleEntry, at: number | null, day: string, ctx: Context): CalendarRow {
  const time = at === null ? null : zonedTime(at, ctx.timeZone);
  const movedHere = time !== null && dayKeyOf(time) !== day;
  return {
    key: `${item.id}@${at ?? 'untimed'}`,
    itemId: item.id,
    day,
    at,
    time: time ? clockText(time) : null,
    dueOn: movedHere && time ? dateWord(time) : null,
    kind: kindWord(item.type),
    title: titleOf(item),
    meta: metaOf(item),
    paused: item.paused,
    overdue: at !== null && isDeadline(item) && at < ctx.now,
  };
}

/** The item's rows on the strip: each run on its day, a missed deadline today, an untimed one today. */
function rowsOf(item: ScheduleEntry, span: Span, ctx: Context): CalendarRow[] {
  const anchor = instantOf(item.next_run_at);
  if (anchor === null) return [rowOf(item, null, ctx.today, ctx)];
  return occurrencesOf(item, anchor, span).flatMap((at) => {
    const day = dayKeyOf(zonedTime(at, ctx.timeZone));
    if (ctx.days.has(day)) return [rowOf(item, at, day, ctx)];
    if (day < ctx.today && isDeadline(item)) return [rowOf(item, at, ctx.today, ctx)];
    return [];
  });
}

function byTime(a: CalendarRow, b: CalendarRow): number {
  if (a.at === b.at) return a.title.localeCompare(b.title);
  if (a.at === null) return 1;
  if (b.at === null) return -1;
  return a.at - b.at;
}

function stripDay(date: CalendarDate, today: string, count: number): StripDay {
  return {
    key: date.key,
    weekday: SHELL_COPY.weekdays[date.weekday],
    day: date.day,
    month: SHELL_COPY.months[date.month],
    today: date.key === today,
    count,
    hasItems: count > 0,
  };
}

function bandItem(item: ScheduleEntry): BandItem {
  return {
    itemId: item.id,
    kind: kindWord(item.type),
    title: titleOf(item),
    agent: item.agent_name?.trim() || null,
    every: everyWord(intervalOf(item) ?? 0),
    paused: item.paused,
  };
}

export function dayModel(input: DayModelInput): DayModel {
  const now = input.now.getTime();
  const days = Array.from({ length: STRIP_DAYS }, (_, offset) =>
    addDays(zonedTime(now, input.timeZone), offset),
  );
  const today = days[0].key;
  const ctx: Context = {
    now,
    timeZone: input.timeZone,
    today,
    days: new Set(days.map((date) => date.key)),
  };
  const span: Span = {
    start: now - DAY_MS - SPAN_MARGIN_MS,
    end: now + STRIP_DAYS * DAY_MS + SPAN_MARGIN_MS,
  };
  const rows = input.items
    .filter((item) => !isAlwaysOn(item))
    .flatMap((item) => rowsOf(item, span, ctx));
  const selected = input.selected && ctx.days.has(input.selected) ? input.selected : today;
  const countOn = (key: string) => rows.filter((row) => row.day === key).length;
  return {
    today,
    selected,
    strip: days.map((date) => stripDay(date, today, countOn(date.key))),
    rows: rows.filter((row) => row.day === selected).sort(byTime),
    band: input.items.filter(isAlwaysOn).map(bandItem),
  };
}
