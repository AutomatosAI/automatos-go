// The head's eyebrow, pure: 'Operations · Mon 19 Oct · 08:14 London' (the eyebrow role sets it in
// capitals), read in the phone's timezone: expo-localization's zone is passed in, never a fixed
// one. The city is the zone's last part ('America/New_York' → 'New York'); a zone without a city
// ('UTC', 'Etc/GMT+5') says itself. The wall clock comes from Intl in that zone; when there is no
// zone, or the engine cannot read it, Date's local fields stand in: the phone's own clock, which
// runs in the same zone.

import { logger } from '../../lib/logger';
import { SHELL_COPY } from '../strings';

/** A moment as the phone's clock shows it: weekday 0 = Sunday, month 0 = January. */
export type WallClock = {
  readonly weekday: number;
  readonly day: number;
  readonly month: number;
  readonly hours: number;
  readonly minutes: number;
};

const MINUTE_MS = 60_000;
const HOURS_PER_DAY = 24;
/** What Intl's 'en-US' short weekday reads; only for parsing, never shown. */
const INTL_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FORMAT: Intl.DateTimeFormatOptions = Object.freeze({
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

export function localClock(now: Date): WallClock {
  return {
    weekday: now.getDay(),
    day: now.getDate(),
    month: now.getMonth(),
    hours: now.getHours(),
    minutes: now.getMinutes(),
  };
}

function zonedClock(now: Date, timeZone: string): WallClock | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { ...FORMAT, timeZone }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((each) => each.type === type)?.value ?? '';
    const weekday = INTL_WEEKDAYS.indexOf(part('weekday'));
    const [day, month, hour, minute] = (['day', 'month', 'hour', 'minute'] as const).map((type) =>
      Number(part(type)),
    );
    if (weekday === -1 || ![day, month, hour, minute].every(Number.isInteger)) return null;
    return { weekday, day, month: month - 1, hours: hour % HOURS_PER_DAY, minutes: minute };
  } catch (error) {
    logger.debug(`[cc/shell] the clock in ${timeZone} could not be read; using the phone's`, error);
    return null;
  }
}

/** The moment in that zone, or on the phone's own clock when there is none or it cannot be read. */
export function wallClock(now: Date, timeZone: string | null): WallClock {
  const zone = timeZone?.trim();
  return (zone ? zonedClock(now, zone) : null) ?? localClock(now);
}

/** 'Europe/London' → 'London', 'America/Argentina/Buenos_Aires' → 'Buenos Aires', 'UTC' → 'UTC'. */
export function zoneCity(timeZone: string | null): string | null {
  const zone = timeZone?.trim();
  if (!zone) return null;
  const last = zone.split('/').pop() ?? zone;
  return last.replace(/_/g, ' ').trim() || null;
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

/** 'Operations · Mon 19 Oct · 08:14 London'; the city is left off when there is none. */
export function eyebrowText(clock: WallClock, city: string | null): string {
  const date = `${SHELL_COPY.weekdays[clock.weekday]} ${clock.day} ${SHELL_COPY.months[clock.month]}`;
  const time = `${twoDigits(clock.hours)}:${twoDigits(clock.minutes)}`;
  return `${SHELL_COPY.eyebrow} · ${date} · ${city ? `${time} ${city}` : time}`;
}

/** How long until the clock next shows a new minute (the eyebrow re-reads it then). */
export function msUntilNextMinute(now: Date): number {
  return MINUTE_MS - (now.getTime() % MINUTE_MS);
}
