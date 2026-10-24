// The in-context ask's counters (KP11, KP18): how many signed-in sessions this phone has had, how
// many times 'Not now' was tapped and when last. One MMKV item (PROMPT_COUNTS_ITEM): numbers and
// dates only, never a key, a token or anything a notification said. A session counts once per
// memory (PushRoot builds one per signed-in session), so a second mount of the same session does
// not count again. A store that fails reads as none and a failed write is logged: the ask then
// holds for this launch on what is in memory. Sign-out's teardown calls clear(). Pure over its
// storage port: PushRoot passes appStorage() (src/storage/mmkv.ts).

import { z } from 'zod';

import { parseJson } from '../../api/json';
import { logger } from '../../lib/logger';
import type { KeyValueStorage } from '../../storage/encrypted-storage';
import { PROMPT_COUNTS_ITEM } from '../config';

export type PromptCounts = Readonly<{
  sessions: number;
  declines: number;
  /** Epoch milliseconds of the last 'Not now', or null. */
  lastDeclinedAt: number | null;
}>;

export type PromptMemory = Readonly<{
  read: () => PromptCounts;
  /** Counts this session once; every later call answers the counts as they are. */
  countSession: () => PromptCounts;
  noteDecline: (at: number) => PromptCounts;
  clear: () => void;
}>;

export const NO_PROMPT_COUNTS: PromptCounts = Object.freeze({
  sessions: 0,
  declines: 0,
  lastDeclinedAt: null,
});

const Count = z.number().int().nonnegative();

const StoredCounts = z.object({
  sessions: Count.catch(0),
  declines: Count.catch(0),
  lastDeclinedAt: Count.nullable().catch(null),
});

/** The stored item as counts; anything unreadable reads as none. */
export function promptCountsFrom(stored: string | null | undefined): PromptCounts {
  const parsed = StoredCounts.safeParse(stored ? parseJson(stored)?.value : undefined);
  return parsed.success ? Object.freeze(parsed.data) : NO_PROMPT_COUNTS;
}

export function withSession(counts: PromptCounts): PromptCounts {
  return Object.freeze({ ...counts, sessions: counts.sessions + 1 });
}

export function withDecline(counts: PromptCounts, at: number): PromptCounts {
  return Object.freeze({ ...counts, declines: counts.declines + 1, lastDeclinedAt: at });
}

export function promptMemoryOver(storage: KeyValueStorage): PromptMemory {
  let memory: PromptCounts | null = null;
  let counted = false;
  const read = (): PromptCounts => {
    if (memory) return memory;
    try {
      memory = promptCountsFrom(storage.getItem(PROMPT_COUNTS_ITEM));
    } catch {
      logger.warn('[push] could not read the notification ask counters; starting from none');
      memory = NO_PROMPT_COUNTS;
    }
    return memory;
  };
  const keep = (next: PromptCounts): PromptCounts => {
    memory = next;
    try {
      storage.setItem(PROMPT_COUNTS_ITEM, JSON.stringify(next));
    } catch {
      logger.warn('[push] could not store the notification ask counters; kept for this launch');
    }
    return next;
  };
  return Object.freeze({
    read,
    countSession: () => {
      if (counted) return read();
      counted = true;
      return keep(withSession(read()));
    },
    noteDecline: (at: number) => keep(withDecline(read(), at)),
    clear: () => {
      memory = NO_PROMPT_COUNTS;
      try {
        storage.removeItem(PROMPT_COUNTS_ITEM);
      } catch {
        logger.warn('[push] could not clear the notification ask counters');
      }
    },
  });
}
