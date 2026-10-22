// When a ticket last changed, as the ticket sheet says it (handoff §2: 'Ledger · updated 08:06'),
// pure and in the phone's timezone (dateline.ts reads the clock): today is the time, the day
// before is Yesterday, the rest of the last week its weekday, anything older its date ('14 Oct').
// A time the server did not send, or one that does not parse, says nothing.

import { SHELL_COPY, TICKET_COPY } from '../strings';
import { wallClock, type WallClock } from '../shell/dateline';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Within this many days a weekday names the day without doubt. */
const WEEK_DAYS = 7;

const twoDigits = (value: number) => String(value).padStart(2, '0');

function sameDay(a: WallClock, b: WallClock): boolean {
  return a.day === b.day && a.month === b.month;
}

function dateWord(clock: WallClock): string {
  return `${clock.day} ${SHELL_COPY.months[clock.month]}`;
}

/** '08:06', 'Yesterday', 'Fri' or '14 Oct'; null for no time or one that does not parse. */
export function updatedWord(
  at: string | null | undefined,
  now: Date,
  timeZone: string | null,
): string | null {
  const moment = at ? new Date(at) : null;
  if (!moment || Number.isNaN(moment.getTime())) return null;
  const then = wallClock(moment, timeZone);
  const elapsed = now.getTime() - moment.getTime();
  if (Math.abs(elapsed) >= WEEK_DAYS * DAY_MS) return dateWord(then);
  if (sameDay(then, wallClock(now, timeZone))) {
    return `${twoDigits(then.hours)}:${twoDigits(then.minutes)}`;
  }
  if (elapsed < 0) return dateWord(then);
  if (sameDay(then, wallClock(new Date(now.getTime() - DAY_MS), timeZone))) {
    return TICKET_COPY.yesterday;
  }
  return SHELL_COPY.weekdays[then.weekday];
}
