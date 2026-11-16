// Each response is handled once (PRD-001 §4.8): a cold-start response read with
// getLastNotificationResponse can arrive again through the response listener, and a launch can
// replay the last one, so the handler remembers what it has done. A response's key is
// `${identifier}:${actionIdentifier}`. A push sent again under a new identifier passes that key, so
// a reply also claims the signed payload it answers (signedReplyKey: its workspace, grant and
// notification ids and its iat), and a second reply carrying the same payload posts nothing. The
// remembered list holds keys and the time each push was signed only — never a question, a reply
// or a payload's words (D-WRITES) — bounded at HANDLED_KEYS_MAX, the oldest dropped.
// A signed payload is accepted for seven days, longer than a busy list keeps its key, so beside the
// list sits a floor: the newest signed time ever dropped from it. A push signed at or before the
// floor whose key is not in the list counts as handled, so a genuine push sent again after its key
// fell off is not acted on twice. The cost: a notification left behind a list's worth of newer
// responses, signed before one already dropped, counts as handled too. Every function returns a new
// value; the stored form is the JSON object {entries: [{key, signedAt}], floor}. The earlier form,
// a JSON array of keys, still reads back, with no times and no floor.

import { z } from 'zod';

import { parseJson } from '../../api/json';
import { HANDLED_KEYS_MAX, PUSH_SIG_MAX_FUTURE_SECONDS } from '../config';
import type { PushPayload } from '../schemas/payload';
import type { InboundEvent } from './parse';

/** One handled response: its key and the time its push was signed, null when it had none. */
export type HandledEntry = Readonly<{ key: string; signedAt: number | null }>;

/** The handled keys, oldest first, and the floor: the newest signed time ever dropped from them. */
export type HandledKeys = Readonly<{ entries: readonly HandledEntry[]; floor: number | null }>;

export const NO_HANDLED_KEYS: HandledKeys = Object.freeze({
  entries: Object.freeze([]),
  floor: null,
});

/** A signed time as a payload carries it (schemas/payload.ts iat): epoch seconds, an integer. */
const SignedTime = z.number().int().safe();
const StoredEntry = z.object({ key: z.string(), signedAt: z.unknown().optional() });
const StoredForm = z.object({ entries: z.array(z.unknown()), floor: z.unknown().optional() });

export function responseKey(event: Pick<InboundEvent, 'id' | 'action'>): string {
  return `${event.id}:${event.action ?? ''}`;
}

/** The signed payload a reply answers, as ids and its time: never its words. */
export function signedReplyKey(
  payload: Pick<PushPayload, 'workspace_id' | 'grant_id' | 'notification_id' | 'iat'>,
): string {
  const ids = [payload.workspace_id, payload.grant_id ?? '', payload.notification_id ?? ''];
  return `signed:${ids.join(':')}:${payload.iat}`;
}

/**
 * The signed time a response's claim keeps: its payload's iat, never later than a fresh one may be
 * by the phone's clock (PUSH_SIG_MAX_FUTURE_SECONDS ahead), so a payload claimed before it is
 * verified can never lift the floor past that. null with no payload or no reading of the clock.
 */
export function signedTimeOf(
  payload: Pick<PushPayload, 'iat'> | null,
  nowSeconds: number,
): number | null {
  if (!payload || !Number.isFinite(nowSeconds)) return null;
  return Math.min(payload.iat, Math.floor(nowSeconds) + PUSH_SIG_MAX_FUTURE_SECONDS);
}

/** The key is in the list, or the push was signed at or before the floor. */
export function wasHandled(
  handled: HandledKeys,
  key: string,
  signedAt: number | null = null,
): boolean {
  if (handled.entries.some((entry) => entry.key === key)) return true;
  return signedAt !== null && handled.floor !== null && signedAt <= handled.floor;
}

/** The floor once these entries are dropped: the newest signed time among them and the floor. */
function floorAfter(floor: number | null, dropped: readonly HandledEntry[]): number | null {
  return dropped.reduce<number | null>((newest, { signedAt }) => {
    if (signedAt === null) return newest;
    return newest === null ? signedAt : Math.max(newest, signedAt);
  }, floor);
}

/** The last HANDLED_KEYS_MAX entries, the floor raised by any dropped: a new value. */
function bounded(entries: readonly HandledEntry[], floor: number | null): HandledKeys {
  const cut = Math.max(0, entries.length - HANDLED_KEYS_MAX);
  return Object.freeze({
    entries: Object.freeze(entries.slice(cut)),
    floor: floorAfter(floor, entries.slice(0, cut)),
  });
}

/** handled with key last (moved there if it was in), at most HANDLED_KEYS_MAX: a new value. */
export function withHandled(
  handled: HandledKeys,
  key: string,
  signedAt: number | null = null,
): HandledKeys {
  const others = handled.entries.filter((entry) => entry.key !== key);
  return bounded([...others, Object.freeze({ key, signedAt })], handled.floor);
}

/** The stored form: the entries (keys and signed times) and the floor, nothing else. */
export function storedHandledKeys(handled: HandledKeys): string {
  const { entries, floor } = bounded(handled.entries, handled.floor);
  const kept = entries.map(({ key, signedAt }) => ({ key, signedAt }));
  return JSON.stringify({ entries: kept, floor });
}

function timeFrom(raw: unknown): number | null {
  const parsed = SignedTime.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** A stored entry: a bare key (the earlier form) or {key, signedAt}; anything else is none. */
function entryFrom(raw: unknown): HandledEntry | null {
  if (typeof raw === 'string') return Object.freeze({ key: raw, signedAt: null });
  const parsed = StoredEntry.safeParse(raw);
  if (!parsed.success) return null;
  return Object.freeze({ key: parsed.data.key, signedAt: timeFrom(parsed.data.signedAt) });
}

/** The stored parts: the earlier form is the bare array of keys, with no floor. */
function storedParts(value: unknown): Readonly<{ entries: readonly unknown[]; floor: unknown }> {
  if (Array.isArray(value)) return { entries: value, floor: null };
  const parsed = StoredForm.safeParse(value);
  if (!parsed.success) return { entries: [], floor: null };
  return { entries: parsed.data.entries, floor: parsed.data.floor };
}

/**
 * The stored form read back: anything unreadable is no keys and no floor, an entry that is not a
 * key is dropped, a signed time or a floor that is not a safe integer is none.
 */
export function handledKeysFrom(stored: string | null | undefined): HandledKeys {
  if (!stored) return NO_HANDLED_KEYS;
  const parts = storedParts(parseJson(stored)?.value);
  const entries = parts.entries
    .map(entryFrom)
    .filter((entry): entry is HandledEntry => entry !== null);
  return bounded(entries, timeFrom(parts.floor));
}
