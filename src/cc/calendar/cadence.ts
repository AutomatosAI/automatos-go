// How often a calendar item runs, in words, pure: the band's 'every 15 min' (handoff §2) and a
// row's meta ('Ledger · weekdays'). A heartbeat's interval reads as the server words it
// (activity_service.py _humanize_interval: minutes, whole hours, whole days); a daily cron by its
// weekdays; another cron as 'recurring'; a deadline says nothing (its kind already says 'Task
// deadline').

import { CALENDAR_COPY, SHELL_COPY } from '../strings';
import { cronOf, dailyCron, intervalOf } from './occurrences';
import type { ScheduleEntry } from './schemas';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];
/** Monday first, as a week reads in words. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ONE_OFF = 'one-off';
const DEADLINE_KINDS: ReadonlySet<string> = new Set(['mission', 'task_due']);

/** 'every 15 min', 'hourly', 'every 2 h', 'daily', 'every 3 days'. */
export function everyWord(minutes: number): string {
  const words = CALENDAR_COPY.cadence;
  if (minutes < MINUTES_PER_HOUR) return words.minutes(minutes);
  if (minutes % MINUTES_PER_DAY === 0) {
    const days = minutes / MINUTES_PER_DAY;
    return days === 1 ? words.daily : words.days(days);
  }
  if (minutes % MINUTES_PER_HOUR !== 0) return words.minutes(minutes);
  const hours = minutes / MINUTES_PER_HOUR;
  return hours === 1 ? words.hourly : words.hours(hours);
}

const isExactly = (days: ReadonlySet<number>, list: readonly number[]) =>
  days.size === list.length && list.every((day) => days.has(day));

/** 'daily', 'weekdays', 'weekends', or the days themselves: 'Mon, Wed, Fri'. */
export function weekdaysWord(days: ReadonlySet<number>): string {
  const words = CALENDAR_COPY.cadence;
  if (days.size === WEEK_ORDER.length) return words.daily;
  if (isExactly(days, WEEKDAYS)) return words.weekdays;
  if (isExactly(days, WEEKEND)) return words.weekends;
  return WEEK_ORDER.filter((day) => days.has(day))
    .map((day) => SHELL_COPY.weekdays[day])
    .join(', ');
}

/** How often it runs, or null when there is nothing to say (a deadline, a word not understood). */
export function cadenceWord(item: ScheduleEntry): string | null {
  if (DEADLINE_KINDS.has(item.type)) return null;
  const interval = intervalOf(item);
  if (interval !== null) return everyWord(interval);
  if (item.frequency?.trim().toLowerCase() === ONE_OFF) return CALENDAR_COPY.cadence.oneOff;
  const cron = dailyCron(cronOf(item));
  if (cron) return weekdaysWord(cron.weekdays);
  return item.recurrence?.cron_expression ? CALENDAR_COPY.cadence.recurring : null;
}
