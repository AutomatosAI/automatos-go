// The brief on open (PRD-268 §6.4, US-C10b, US-G06), pure over its ports: on the first foreground of
// each local date the app calls POST /api/proactive/brief/open once with that date and the phone's
// IANA timezone, so the day's brief is waiting in the Auto thread. The server claims the day once per
// person, workspace and date (every device and the scheduled digest share the claim), so a second
// call answers the same message; the phone still calls once per date per workspace, and never twice
// at the same time. Memory only (D-CACHE): a cold start is a first foreground, and the server's
// claim keeps it one brief. A call that answers a message settles the day; pending (another device
// is still building it) and a failure that may pass (offline, a 5xx) leave it for the next
// foreground; a refusal that will not pass today (403, 404, 422) settles it too, so the phone does
// not ask again on every return. The local date is read in the phone's zone: Intl in that zone, or
// the phone's own clock when there is no zone or the engine cannot read it.

import { isApiError } from '../api/errors';
import { logger } from '../lib/logger';
import type { BriefOpenBody } from './api';
import type { BriefOpen } from './schema';

/** UTC when the phone reports no zone; core refuses a name that is not IANA (422). */
export const FALLBACK_TIME_ZONE = 'UTC';

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${twoDigits(month)}-${twoDigits(day)}`;
}

function zonedDate(now: Date, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((each) => each.type === type)?.value);
    const [year, month, day] = [part('year'), part('month'), part('day')];
    return [year, month, day].every(Number.isInteger) ? isoDate(year, month, day) : null;
  } catch (error) {
    logger.debug(`[brief] the date in ${timeZone} could not be read; using the phone's`, error);
    return null;
  }
}

/** The phone's local date (YYYY-MM-DD) in its zone, or on its own clock. */
export function localDateIn(now: Date, timeZone: string | null): string {
  const zone = timeZone?.trim();
  const zoned = zone ? zonedDate(now, zone) : null;
  return zoned ?? isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** The answer names the day's message: the day is settled. */
export function answersTheDay(answer: BriefOpen): boolean {
  return answer.posted || answer.message_id !== null;
}

const SETTLING_STATUSES: ReadonlySet<number> = new Set([422]);

/** A refusal that will not pass today: asking again on every return would only repeat it. */
export function refusalSettlesTheDay(error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (error.kind === 'forbidden' || error.kind === 'not_found') return true;
  return error.status !== undefined && SETTLING_STATUSES.has(error.status);
}

export type BriefOpenerDeps = {
  readonly open: (body: BriefOpenBody) => Promise<BriefOpen>;
  readonly now: () => Date;
  readonly timeZone: () => string | null;
  /** The day's message is there (posted now, or earlier): the thread reads it again. */
  readonly onAnswered: (answer: BriefOpen) => void;
};

export type BriefOpener = {
  /** A foreground in this workspace: calls the route unless today is settled or a call is out. */
  readonly foreground: (scope: string) => Promise<void>;
};

/** One opener per app: the settled date per workspace, and the call in flight. */
export function createBriefOpener(deps: BriefOpenerDeps): BriefOpener {
  let settled: ReadonlyMap<string, string> = new Map();
  let inFlight: string | null = null;
  const settle = (scope: string, date: string) => {
    settled = new Map([...settled, [scope, date]]);
  };
  return Object.freeze({
    foreground: async (scope: string) => {
      const zone = deps.timeZone()?.trim() || null;
      const today = localDateIn(deps.now(), zone);
      const key = `${scope}\n${today}`;
      if (settled.get(scope) === today || inFlight === key) return;
      inFlight = key;
      try {
        const answer = await deps.open({ local_date: today, timezone: zone ?? FALLBACK_TIME_ZONE });
        if (answersTheDay(answer)) {
          settle(scope, today);
          deps.onAnswered(answer);
        }
      } catch (error) {
        if (refusalSettlesTheDay(error)) settle(scope, today);
        logger.warn("[brief] today's brief could not be opened", error);
      } finally {
        if (inFlight === key) inFlight = null;
      }
    },
  });
}
