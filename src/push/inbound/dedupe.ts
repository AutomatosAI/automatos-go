// Each response is handled once (PRD-001 §4.8): a cold-start response read with
// getLastNotificationResponse can arrive again through the response listener, and a launch can
// replay the last one, so the handler remembers what it has done. A response's key is
// `${identifier}:${actionIdentifier}` and the remembered list holds keys only — never a question,
// a reply or a payload (D-WRITES) — bounded at HANDLED_KEYS_MAX, the oldest dropped. Every
// function returns a new array; the stored form is the JSON array of keys.

import { z } from 'zod';

import { parseJson } from '../../api/json';
import { HANDLED_KEYS_MAX } from '../config';
import type { InboundEvent } from './parse';

export type HandledKeys = readonly string[];

const StoredKeys = z.array(z.unknown());

export function responseKey(event: Pick<InboundEvent, 'id' | 'action'>): string {
  return `${event.id}:${event.action ?? ''}`;
}

export function wasHandled(keys: HandledKeys, key: string): boolean {
  return keys.includes(key);
}

/** keys with key last (moved there if it was already in), at most HANDLED_KEYS_MAX, a new array. */
export function withHandled(keys: HandledKeys, key: string): HandledKeys {
  const next = [...keys.filter((existing) => existing !== key), key];
  return Object.freeze(next.slice(-HANDLED_KEYS_MAX));
}

/** The stored form: a JSON array of keys and nothing else. */
export function storedHandledKeys(keys: HandledKeys): string {
  return JSON.stringify(keys.slice(-HANDLED_KEYS_MAX));
}

/** The stored form read back; anything unreadable is an empty list, a non-string entry is dropped. */
export function handledKeysFrom(stored: string | null | undefined): HandledKeys {
  if (!stored) return Object.freeze([]);
  const parsed = StoredKeys.safeParse(parseJson(stored)?.value);
  if (!parsed.success) return Object.freeze([]);
  const keys = parsed.data.filter((entry): entry is string => typeof entry === 'string');
  return Object.freeze(keys.slice(-HANDLED_KEYS_MAX));
}
