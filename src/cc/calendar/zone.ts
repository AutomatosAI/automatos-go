// The phone's calendar, pure: which day an instant falls on and what the clock reads then, in the
// phone's timezone (expo-localization's zone is passed in, never a fixed one), and a zone's offset
// for stepping a daily schedule across a clock change. Intl reads the zone; when there is no zone,
// or the engine cannot read it, Date's local fields stand in: the phone's own clock, which runs in
// the same zone (as the shell's dateline.ts does). Days are 'YYYY-MM-DD' keys, which sort as dates.

import { logger } from '../../lib/logger';

/** A moment as a zone's clock shows it: month 0 = January, weekday 0 = Sunday. */
export type ZonedTime = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly weekday: number;
  readonly hours: number;
  readonly minutes: number;
};

const MINUTE_MS = 60_000;
const HOURS_PER_DAY = 24;
/** What Intl's 'en-US' short weekday reads; only for parsing, never shown. */
const INTL_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FORMAT: Intl.DateTimeFormatOptions = Object.freeze({
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

/**
 * One formatter per zone, made once: a week of a calendar reads the clock hundreds of times and
 * Hermes makes an Intl formatter slowly. A zone the engine refuses is remembered as null.
 */
const formatters = new Map<string, Intl.DateTimeFormat | null>();

function formatterFor(zone: string): Intl.DateTimeFormat | null {
  const known = formatters.get(zone);
  if (known !== undefined) return known;
  let made: Intl.DateTimeFormat | null = null;
  try {
    made = new Intl.DateTimeFormat('en-US', { ...FORMAT, timeZone: zone });
  } catch (error) {
    logger.debug(`[cc/calendar] the clock in ${zone} could not be read; using the phone's`, error);
  }
  formatters.set(zone, made);
  return made;
}

function localTime(at: Date): ZonedTime {
  return {
    year: at.getFullYear(),
    month: at.getMonth(),
    day: at.getDate(),
    weekday: at.getDay(),
    hours: at.getHours(),
    minutes: at.getMinutes(),
  };
}

function intlTime(at: Date, formatter: Intl.DateTimeFormat): ZonedTime | null {
  const parts = formatter.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((each) => each.type === type)?.value ?? '';
  const weekday = INTL_WEEKDAYS.indexOf(part('weekday'));
  const [year, month, day, hour, minute] = (
    ['year', 'month', 'day', 'hour', 'minute'] as const
  ).map((type) => Number(part(type)));
  if (weekday === -1 || ![year, month, day, hour, minute].every(Number.isInteger)) return null;
  return { year, month: month - 1, day, weekday, hours: hour % HOURS_PER_DAY, minutes: minute };
}

/** The moment on that zone's clock, or on the phone's own when there is none or it cannot be read. */
export function zonedTime(at: number, timeZone: string | null): ZonedTime {
  const moment = new Date(at);
  const zone = timeZone?.trim();
  const formatter = zone ? formatterFor(zone) : null;
  return (formatter ? intlTime(moment, formatter) : null) ?? localTime(moment);
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

/** 'YYYY-MM-DD' for a calendar date (month 0 = January). */
export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${twoDigits(month + 1)}-${twoDigits(day)}`;
}

/** The day the moment falls on in that zone. */
export function dayKeyOf(time: ZonedTime): string {
  return dateKey(time.year, time.month, time.day);
}

/** '09:05'. */
export function clockText(time: ZonedTime): string {
  return `${twoDigits(time.hours)}:${twoDigits(time.minutes)}`;
}

/** How far that zone's clock runs ahead of UTC at the moment, in minutes (London in summer: 60). */
export function zoneOffsetMinutes(at: number, timeZone: string | null): number {
  const time = zonedTime(at, timeZone);
  const wall = Date.UTC(time.year, time.month, time.day, time.hours, time.minutes);
  const minute = at - (((at % MINUTE_MS) + MINUTE_MS) % MINUTE_MS);
  return Math.round((wall - minute) / MINUTE_MS);
}

/** A calendar day counted from another, as the calendar counts it (no clock change in it). */
export type CalendarDate = {
  readonly key: string;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly weekday: number;
};

/** The day `offset` days after the given one: 31 Dec + 1 is 1 Jan of the next year. */
export function addDays(from: ZonedTime, offset: number): CalendarDate {
  const date = new Date(Date.UTC(from.year, from.month, from.day + offset));
  const [year, month, day] = [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
  return { key: dateKey(year, month, day), year, month, day, weekday: date.getUTCDay() };
}
