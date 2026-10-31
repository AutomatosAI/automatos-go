// Times in Candy's words (PRD-001 §4.6.2, KA3-VENDOR-PIN): how long ago a thing started waiting on
// Today's Needs-you rows ('12 min ago'), and the day a Deliverable landed on the shelf ('Mon').
// Pure: no React, React Native, Expo or Skia.
//
// Source: AutomatosAI/automatos-design-kit themes/candy/src/ui/when.ts at 3920359d5
// (3920359d5350960471aca1b7111f6243be537cc0), sha256
// 485903766ea529ee5266f5d5867ad54430dcdc5cf8b5135b1f69ae1f1e26913d. Copied; only the layout
// (semicolons) is the repo's.

/**
 * Times in Candy's words, from the host's ISO timestamps: how long ago ("Now", "12 min ago", "2 h ago",
 * "Yesterday", "Mon", "Oct 24"), a short form for a list's right edge ("Now", "2 h", "Yesterday", "Mon", "Oct 24"),
 * a day ("Today", "Yesterday", "Mon", "Oct 24") and a time of day ahead ("16:00", "Tomorrow", "Fri", "Nov 3").
 * `now` is passed in, so every function is pure and every test fixed. An unreadable time is null.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** A past day this many calendar days back or fewer is named by its weekday ("Mon"); further back, by its date. */
const WEEKDAY_DAYS = 5;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function timeOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : null;
}

function startOfDay(time: number): number {
  const day = new Date(time);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
}

/** Whole calendar days from `time`'s day to `now`'s (0 today, 1 yesterday, -1 tomorrow). */
function daysBetween(time: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(time)) / DAY);
}

function dateWords(time: number): string {
  const day = new Date(time);
  return `${MONTHS[day.getMonth()]} ${day.getDate()}`;
}

/** A past day: "Today", "Yesterday", a weekday up to five days back, else "Oct 24". */
export function dayWords(iso: string | null | undefined, now: number): string | null {
  const time = timeOf(iso);
  if (time === null) return null;
  const days = daysBetween(time, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= WEEKDAY_DAYS) return WEEKDAYS[new Date(time).getDay()];
  return dateWords(time);
}

/** How long ago: "Now" within a minute, minutes, hours within the day, then as dayWords. */
export function agoWords(iso: string | null | undefined, now: number): string | null {
  const time = timeOf(iso);
  if (time === null) return null;
  const gone = now - time;
  if (gone < MINUTE) return 'Now';
  if (gone < HOUR) return `${Math.floor(gone / MINUTE)} min ago`;
  if (gone < DAY && daysBetween(time, now) === 0) return `${Math.floor(gone / HOUR)} h ago`;
  return dayWords(iso, now);
}

/** The short form at a list's right edge: "Now", "12 min", "2 h", then as dayWords. */
export function shortWhen(iso: string | null | undefined, now: number): string | null {
  const words = agoWords(iso, now);
  return words === null ? null : words.replace(/ ago$/, '');
}

/** A time ahead: "16:00" later today, "Tomorrow", a weekday up to five days on, else "Nov 3". */
export function aheadWords(iso: string | null | undefined, now: number): string | null {
  const time = timeOf(iso);
  if (time === null) return null;
  const days = -daysBetween(time, now);
  if (days <= 0) {
    const at = new Date(time);
    return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  }
  if (days === 1) return 'Tomorrow';
  if (days <= WEEKDAY_DAYS) return WEEKDAYS[new Date(time).getDay()];
  return dateWords(time);
}
