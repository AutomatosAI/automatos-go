// When a calendar item happens inside a window, pure: the feed sends each item once, at its next
// run, and the week shows every run (the web's calendar-model.ts expandItem, behaviour reference).
// A routine steps by its heartbeat interval, except one at the band's cadence or faster, which
// lives in the always-on band only; an 'Every Nh' item steps by its interval; a cron at a fixed
// time on every day of the month (on some or all weekdays) steps a day at a time in the cron's
// own timezone, so a clock change keeps it at its hour; anything else (a one-off, a deadline, a
// social post, a cron this reads no further) is its next run alone. The web reads crons on the
// browser's clock and ignores a day-of-month; this reads them as the server does.

import type { ScheduleEntry } from './schemas';
import { zonedTime, zoneOffsetMinutes } from './zone';

/** The web's BAND_MAX_INTERVAL_MIN: heartbeats this frequent are summarised, not plotted. */
export const BAND_MAX_INTERVAL_MIN = 60;
/** The web's safety cap per item. */
export const MAX_OCCURRENCES = 200;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const WEEK_DAYS = 7;
/** The server's zone for a cron that names none (services/schedule_util). */
const CRON_DEFAULT_ZONE = 'UTC';

/** [start, end] in epoch milliseconds, both inclusive. */
export type Span = { readonly start: number; readonly end: number };

/** A cron that fires at one time of day on these weekdays (0 = Sunday) of every month. */
export type DailyCron = { readonly weekdays: ReadonlySet<number> };

const PLAIN_NUMBER = /^\d+$/;
const DAY_RANGE = /^(\d)-(\d)$/;
const SINGLE_DAY = /^\d$/;
const EVERY = /every\s+(\d+)\s*(m|min|h|hr|d|day)/i;

/** The web's parseIntervalMinutes: 'Every 30m', 'Every 8h', 'Every 1d' → minutes; else null. */
export function parseIntervalMinutes(frequency: string | null): number | null {
  const match = frequency?.match(EVERY);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('m')) return value;
  return unit.startsWith('h') ? value * 60 : value * 24 * 60;
}

/** 0..7 (7 and 0 are both Sunday, as cron reads them). */
function cronDays(part: string): number[] | null {
  const range = part.match(DAY_RANGE);
  if (range) {
    const [from, to] = [Number(range[1]), Number(range[2])];
    return from <= to ? Array.from({ length: to - from + 1 }, (_, i) => from + i) : null;
  }
  return SINGLE_DAY.test(part) ? [Number(part)] : null;
}

function weekdaysOf(field: string): ReadonlySet<number> | null {
  if (field === '*') return new Set(Array.from({ length: WEEK_DAYS }, (_, i) => i));
  const days = field.split(',').map(cronDays);
  if (days.some((each) => each === null)) return null;
  const flat = days.flatMap((each) => each ?? []);
  return flat.every((day) => day <= WEEK_DAYS) ? new Set(flat.map((day) => day % WEEK_DAYS)) : null;
}

/** '0 9 * * 1-5' → weekdays 1..5; anything but a fixed time on every day of the month → null. */
export function dailyCron(expression: string | null): DailyCron | null {
  const fields = expression?.trim().split(/\s+/) ?? [];
  if (fields.length !== 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  if (!PLAIN_NUMBER.test(minute) || !PLAIN_NUMBER.test(hour)) return null;
  if (dayOfMonth !== '*' || month !== '*') return null;
  const weekdays = weekdaysOf(dayOfWeek);
  return weekdays && weekdays.size > 0 ? { weekdays } : null;
}

/** The item's cron: the structured one, else a frequency that is a cron (a recipe, a task). */
export function cronOf(item: ScheduleEntry): string | null {
  return item.recurrence?.cron_expression ?? item.frequency;
}

/** A routine's heartbeat interval; another item's 'Every Nh' frequency. */
export function intervalOf(item: ScheduleEntry): number | null {
  const structured = item.recurrence?.interval_minutes ?? null;
  return item.type === 'routine'
    ? structured
    : (structured ?? parseIntervalMinutes(item.frequency));
}

/** A heartbeat at the band's cadence or faster: the always-on band, never a row. */
export function isAlwaysOn(item: ScheduleEntry): boolean {
  const interval = intervalOf(item);
  return item.type === 'routine' && interval !== null && interval <= BAND_MAX_INTERVAL_MIN;
}

/** The ISO instant as epoch milliseconds, or null for none or one that does not parse. */
export function instantOf(iso: string | null): number | null {
  const at = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(at) ? null : at;
}

function intervalSteps(anchor: number, stepMs: number, span: Span): number[] {
  const first = Math.ceil((span.start - anchor) / stepMs);
  const last = Math.floor((span.end - anchor) / stepMs);
  const count = Math.min(Math.max(last - first + 1, 0), MAX_OCCURRENCES);
  return Array.from({ length: count }, (_, i) => anchor + (first + i) * stepMs);
}

/** A day at a time from the server's next run, held at its hour across a clock change. */
function dailySteps(anchor: number, cron: DailyCron, zone: string, span: Span): number[] {
  const anchorOffset = zoneOffsetMinutes(anchor, zone);
  const first = Math.ceil((span.start - anchor) / DAY_MS) - 1;
  const last = Math.floor((span.end - anchor) / DAY_MS) + 1;
  return Array.from({ length: Math.max(last - first + 1, 0) }, (_, i) => {
    const naive = anchor + (first + i) * DAY_MS;
    return naive + (anchorOffset - zoneOffsetMinutes(naive, zone)) * MINUTE_MS;
  }).filter(
    (at) => at >= span.start && at <= span.end && cron.weekdays.has(zonedTime(at, zone).weekday),
  );
}

/**
 * Every run of the item inside the span. A routine in the band has none here. An item that does
 * not repeat is its next run, wherever that falls: the day model decides what to do with it.
 */
export function occurrencesOf(item: ScheduleEntry, anchor: number, span: Span): number[] {
  if (isAlwaysOn(item)) return [];
  const interval = intervalOf(item);
  // the web's rule for both: a slower routine and an 'Every Nh' item step; a faster item is one run
  if (interval !== null && interval > BAND_MAX_INTERVAL_MIN) {
    return intervalSteps(anchor, interval * MINUTE_MS, span);
  }
  const cron = item.type === 'routine' ? null : dailyCron(cronOf(item));
  if (cron) {
    const zone = item.recurrence?.timezone?.trim() || CRON_DEFAULT_ZONE;
    return dailySteps(anchor, cron, zone, span);
  }
  return [anchor];
}
