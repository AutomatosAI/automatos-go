// When a calendar item happens inside a window, pure: the feed sends each item once, at its next
// run, and the week shows every run (the web's calendar-model.ts expandItem, behaviour reference).
// A routine steps by its heartbeat interval, except one at the band's cadence or faster, which
// lives in the always-on band only; an 'Every Nh' item steps by its interval; anything else (a
// one-off, a deadline, a social post, a cron this reads no further) is its next run alone. A cron
// at a fixed time on every day of the month (on some or all weekdays) runs at the cron's own hour
// on each matching weekday in the cron's zone, as the scheduler fires it (playbook_scheduler.py)
// and the web's calendar-model.ts places it, held at that hour across a clock change. The feed's
// next_run_at is no guide to that hour: the server computes it in UTC (schedule_util.py next_run),
// so a cron outside UTC has an anchor at the wrong hour, near midnight on the wrong day. The web
// reads crons on the browser's clock and ignores a day-of-month; this reads them as the server does.

import type { ScheduleEntry } from './schemas';
import { addDays, zonedTime, zoneOffsetMinutes, type CalendarDate } from './zone';

/** The web's BAND_MAX_INTERVAL_MIN: heartbeats this frequent are summarised, not plotted. */
export const BAND_MAX_INTERVAL_MIN = 60;
/** The web's safety cap per item. */
export const MAX_OCCURRENCES = 200;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const WEEK_DAYS = 7;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;
/** The server's zone for a cron that names none (services/schedule_util). */
const CRON_DEFAULT_ZONE = 'UTC';

/** [start, end] in epoch milliseconds, both inclusive. */
export type Span = { readonly start: number; readonly end: number };

/** A cron that fires at one time of day on these weekdays (0 = Sunday) of every month. */
export type DailyCron = {
  readonly hour: number;
  readonly minute: number;
  readonly weekdays: ReadonlySet<number>;
};

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

/** A plain minute and hour ('30', '7'); a step, a list, a range or one out of range → null. */
function clockOf(minute: string, hour: string): Pick<DailyCron, 'hour' | 'minute'> | null {
  if (!PLAIN_NUMBER.test(minute) || !PLAIN_NUMBER.test(hour)) return null;
  const [atHour, atMinute] = [Number(hour), Number(minute)];
  return atHour <= MAX_HOUR && atMinute <= MAX_MINUTE ? { hour: atHour, minute: atMinute } : null;
}

/** '0 9 * * 1-5' → 09:00 on weekdays 1..5; anything but a fixed time on every day of the month → null. */
export function dailyCron(expression: string | null): DailyCron | null {
  const fields = expression?.trim().split(/\s+/) ?? [];
  if (fields.length !== 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  const clock = clockOf(minute, hour);
  if (!clock || dayOfMonth !== '*' || month !== '*') return null;
  const weekdays = weekdaysOf(dayOfWeek);
  return weekdays && weekdays.size > 0 ? { ...clock, weekdays } : null;
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

/** The instant the zone's clock reads the cron's time on that date, at the zone's offset then. */
function zonedInstant(date: CalendarDate, cron: DailyCron, zone: string): number {
  const wall = Date.UTC(date.year, date.month, date.day, cron.hour, cron.minute);
  const guess = wall - zoneOffsetMinutes(wall, zone) * MINUTE_MS;
  return wall - zoneOffsetMinutes(guess, zone) * MINUTE_MS;
}

/** The cron's time on every day of the span, in its zone, whose weekday there is one of its own. */
function dailyRuns(cron: DailyCron, zone: string, span: Span): number[] {
  const firstDay = zonedTime(span.start, zone);
  const days = Math.ceil((span.end - span.start) / DAY_MS) + 2;
  return Array.from({ length: days }, (_, offset) => addDays(firstDay, offset))
    .filter((date) => cron.weekdays.has(date.weekday))
    .map((date) => zonedInstant(date, cron, zone))
    .filter((at) => at >= span.start && at <= span.end);
}

/**
 * Every run of the item inside the span. A routine in the band has none here. A daily cron is at
 * its own hour, never the anchor's. An item that does not repeat is its next run, wherever that
 * falls: the day model decides what to do with it.
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
    return dailyRuns(cron, zone, span);
  }
  return [anchor];
}
