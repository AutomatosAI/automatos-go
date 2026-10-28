// What became of the last notification taps (fix/notification-taps: never lose the evidence
// again). Each handled response leaves one entry — its kind (open, answer, neutral, unhandled,
// error), why (a neutral reason, and for an unverified push what the check found: no_record,
// other_server, keychain, no_key, stale, mismatch, digest_failed, not_v2), the link type it named
// (a known one, else 'other') and the time — in ONE MMKV item (TAP_LOG_ITEM), the newest first, at
// most TAP_LOG_MAX. Never a payload, a key, a sig, a title, a question or a reply (D-WRITES).
// Settings → Notifications shows it as "Recent notification taps". The pure half (entries, the
// stored form) is tested over memory; tapLogOver binds a store. Sign-out empties the encrypted
// store (clearUserData step 6), this item with it. A store that fails reads as none and never
// stops a tap.

import { z } from 'zod';

import { parseJson } from '../../api/json';
import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import {
  APPROVAL_LINK_TYPE,
  CHAT_LINK_TYPE,
  MISSION_LINK_TYPE,
  QUESTION_LINK_TYPE,
  SOCIAL_POST_LINK_TYPE,
  TAP_LOG_ITEM,
  TAP_LOG_MAX,
  TASK_LINK_TYPE,
} from '../config';

export const TAP_KINDS = ['open', 'answer', 'neutral', 'unhandled', 'error'] as const;
export type TapKind = (typeof TAP_KINDS)[number];

/** The link types an entry names as they are; any other is 'other' (an unverified push's is junk). */
const KNOWN_LINK_TYPES: ReadonlySet<string> = new Set([
  QUESTION_LINK_TYPE,
  TASK_LINK_TYPE,
  SOCIAL_POST_LINK_TYPE,
  CHAT_LINK_TYPE,
  APPROVAL_LINK_TYPE,
  MISSION_LINK_TYPE,
]);
const OTHER_LINK_TYPE = 'other';
/** A reason is a short word of this code's own; anything longer is cut. */
const WORD_MAX = 32;

const TapShape = z.object({
  kind: z.enum(TAP_KINDS),
  reason: z.string().max(WORD_MAX).nullable(),
  detail: z.string().max(WORD_MAX).nullable(),
  linkType: z.string().max(WORD_MAX).nullable(),
  /** Epoch milliseconds, the phone's clock. */
  at: z.number().int().nonnegative(),
});

export type TapEntry = Readonly<z.output<typeof TapShape>>;

/** What the handler reports for one response (the time is the log's). */
export type TapReport = Readonly<{
  kind: TapKind;
  reason?: string | null;
  detail?: string | null;
  linkType?: string | null;
}>;

export type TapLog = Readonly<{
  record: (report: TapReport) => void;
  /** The entries, newest first. */
  read: () => readonly TapEntry[];
  clear: () => void;
}>;

/** A link type as an entry keeps it: a known one, 'other', or null for none. */
export function linkTypeWord(linkType: string | null | undefined): string | null {
  const word = linkType?.trim();
  if (!word) return null;
  return KNOWN_LINK_TYPES.has(word) ? word : OTHER_LINK_TYPE;
}

function word(text: string | null | undefined): string | null {
  const value = text?.trim();
  return value ? value.slice(0, WORD_MAX) : null;
}

/** One entry from a report, at this time. */
export function tapEntryOf(report: TapReport, at: number): TapEntry {
  return Object.freeze({
    kind: report.kind,
    reason: word(report.reason),
    detail: word(report.detail),
    linkType: linkTypeWord(report.linkType),
    at: Math.max(0, Math.floor(at)),
  });
}

/** entries with entry first, at most TAP_LOG_MAX: a new array. */
export function withTap(entries: readonly TapEntry[], entry: TapEntry): readonly TapEntry[] {
  return Object.freeze([entry, ...entries].slice(0, TAP_LOG_MAX));
}

/** The stored form read back: anything unreadable is none, an entry that does not fit is dropped. */
export function tapsFrom(stored: string | null | undefined): readonly TapEntry[] {
  const parsed = z.array(z.unknown()).safeParse(stored ? parseJson(stored)?.value : undefined);
  if (!parsed.success) return Object.freeze([]);
  const entries = parsed.data.flatMap((raw) => {
    const entry = TapShape.safeParse(raw);
    return entry.success ? [Object.freeze(entry.data)] : [];
  });
  return Object.freeze(entries.slice(0, TAP_LOG_MAX));
}

/** The log over one store (PushRoot passes appStorage()); now is the phone's clock. */
export function tapLogOver(storage: KeyValueStorage, now: () => number = Date.now): TapLog {
  const read = (): readonly TapEntry[] => {
    try {
      return tapsFrom(storage.getItem(TAP_LOG_ITEM));
    } catch {
      return Object.freeze([]);
    }
  };
  return Object.freeze({
    record: (report: TapReport) => {
      logger.info('[push] tap', report.kind, report.reason ?? '', report.detail ?? '');
      try {
        storage.setItem(TAP_LOG_ITEM, JSON.stringify(withTap(read(), tapEntryOf(report, now()))));
      } catch {
        logger.warn('[push] could not keep a tap in the log');
      }
    },
    read,
    clear: () => {
      try {
        storage.removeItem(TAP_LOG_ITEM);
      } catch {
        logger.warn('[push] could not clear the tap log');
      }
    },
  });
}
