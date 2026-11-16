// When a limit lifts (docs/app-standard.md rule 6.2), pure: a 429's Retry-After (RFC 9110 §10.2.3)
// is a delay in whole seconds or an HTTP date, and a body may say retry_after_seconds beside it.
// The header wins; the wait is read against the clock the caller hands in, never the phone's own
// read here. A wait that is missing, unparseable, negative or further off than RETRY_AFTER_MAX_MS
// is unknown (null): the words then say "later", and nothing is ever scheduled from it.

import { RETRY_AFTER_MAX_MS } from './config';

const MS_PER_SECOND = 1_000;
/** delay-seconds: digits only (no sign, no fraction); ten of them is already far past the cap. */
const DELAY_SECONDS = /^\d{1,10}$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** IMF-fixdate, the one date form a server sends: 'Sun, 06 Nov 1994 08:49:37 GMT'. */
const IMF_FIXDATE =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) ([A-Z][a-z]{2}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;
const LAST_HOUR = 23;
const LAST_MINUTE = 59;

/** A wait the app will word: from now up to the cap; anything else is unknown. */
export function saneWaitMs(ms: number | null | undefined): number | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null;
  return ms >= 0 && ms <= RETRY_AFTER_MAX_MS ? ms : null;
}

type DateParts = {
  readonly day: number;
  readonly month: number;
  readonly year: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
};

function partsOf(match: RegExpExecArray): DateParts {
  const at = (index: number) => Number(match[index]);
  const month = MONTHS.indexOf(match[2] ?? '');
  return { day: at(1), month, year: at(3), hour: at(4), minute: at(5), second: at(6) };
}

function inRange(parts: DateParts): boolean {
  const { month, hour, minute, second } = parts;
  return month >= 0 && hour <= LAST_HOUR && minute <= LAST_MINUTE && second <= LAST_MINUTE;
}

/** The instant an IMF-fixdate names (epoch ms), or null when it is not one or not a real day. */
export function httpDateMs(text: string): number | null {
  const match = IMF_FIXDATE.exec(text);
  if (!match) return null;
  const parts = partsOf(match);
  if (!inRange(parts)) return null;
  const { day, month, year, hour, minute, second } = parts;
  const ms = Date.UTC(year, month, day, hour, minute, second);
  // Date.UTC rolls 31 Feb over into March: such a date is not one
  return new Date(ms).getUTCDate() === day ? ms : null;
}

/** Retry-After as a wait from `now` (ms): its seconds, or its date less `now`; null when unknown. */
export function headerWaitMs(
  header: string | null | undefined,
  now: number | undefined,
): number | null {
  const text = header?.trim() ?? '';
  if (DELAY_SECONDS.test(text)) return saneWaitMs(Number(text) * MS_PER_SECOND);
  const at = httpDateMs(text);
  return at === null || now === undefined ? null : saneWaitMs(at - now);
}

/** How long a limit asks the caller to wait (ms): the header's, else the body's; null when unknown. */
export function limitWaitMs(
  header: string | null | undefined,
  bodySeconds: number | undefined,
  now: number | undefined,
): number | null {
  const fromHeader = headerWaitMs(header, now);
  if (fromHeader !== null) return fromHeader;
  return bodySeconds === undefined ? null : saneWaitMs(bodySeconds * MS_PER_SECOND);
}
