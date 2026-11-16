// The list of handled responses (dedupe.ts): each key remembered once with the time its push was
// signed, keys and times only, at most HANDLED_KEYS_MAX; beside it the floor, the newest signed
// time ever dropped, so a push signed at or before it whose key fell off the list counts as handled.
// The floor is kept in the stored form, read back as none when malformed, and forgotten by clear().

import { describe, expect, it } from 'vitest';

import { HANDLED_KEYS_ITEM, HANDLED_KEYS_MAX, PUSH_SIG_MAX_FUTURE_SECONDS } from '../config';
import {
  NO_HANDLED_KEYS,
  handledKeysFrom,
  responseKey,
  signedTimeOf,
  storedHandledKeys,
  wasHandled,
  withHandled,
  type HandledKeys,
} from '../inbound/dedupe';
import { handledStoreOver } from '../inbound/handled-store';
import { fromResponse } from '../inbound/parse';
import { FULL } from './data-fixtures';
import { memoryStorage } from './handler-fixtures';
import { IOS_ID, deepFreeze, iosResponse } from './inbound-fixtures';

const T = 1_792_540_800;

/** The list after these keys, in order, each signed `at(n)`: a new value at every step. */
function handledAll(count: number, at: (n: number) => number | null = (n) => T + n): HandledKeys {
  return Array.from({ length: count }, (_, n) => n).reduce((handled: HandledKeys, n) => {
    const next = withHandled(handled, `id-${n}:open`, at(n));
    expect(next).not.toBe(handled);
    return next;
  }, NO_HANDLED_KEYS);
}

const keysOf = (handled: HandledKeys) => handled.entries.map((entry) => entry.key);

describe('the handled list', () => {
  it('a response key is `${identifier}:${actionIdentifier}`', () => {
    const event = fromResponse(iosResponse('reply', 'the reply'));
    if (event.kind !== 'readable') throw new Error('expected a readable event');
    expect(responseKey(event)).toBe(`${IOS_ID}:reply`);
    expect(responseKey({ id: IOS_ID, action: null })).toBe(`${IOS_ID}:`);
  });

  it(`is bounded at HANDLED_KEYS_MAX (${HANDLED_KEYS_MAX}), the oldest dropped, a new value each time`, () => {
    const handled = handledAll(HANDLED_KEYS_MAX + 5);
    expect(handled.entries).toHaveLength(HANDLED_KEYS_MAX);
    expect(handled.entries[0]).toEqual({ key: 'id-5:open', signedAt: T + 5 });
    expect(wasHandled(handled, 'id-4:open')).toBe(false);
    expect(wasHandled(handled, `id-${HANDLED_KEYS_MAX + 4}:open`)).toBe(true);
  });

  it('a key handled again moves to the end, once, with its new time', () => {
    const handled = withHandled(withHandled(withHandled(NO_HANDLED_KEYS, 'a', 1), 'b', 2), 'a', 3);
    expect(handled.entries).toEqual([
      { key: 'b', signedAt: 2 },
      { key: 'a', signedAt: 3 },
    ]);
  });

  it('the stored form holds keys, times and the floor, nothing else, and reads back', () => {
    const handled = withHandled(handledAll(HANDLED_KEYS_MAX + 1), `${IOS_ID}:reply`, FULL.iat);
    const stored = storedHandledKeys(handled);
    expect(Object.keys(JSON.parse(stored))).toEqual(['entries', 'floor']);
    for (const text of [FULL.question ?? '', FULL.sig, 'Later']) {
      expect(stored).not.toContain(text);
    }
    expect(handledKeysFrom(stored)).toEqual(handled);
  });

  it.each([[null], [undefined], [''], ['{bad'], ['{"a":1}'], ['"key"'], ['{"entries":7}']])(
    'stored %j reads as no keys and no floor',
    (stored) => {
      expect(handledKeysFrom(stored)).toEqual(NO_HANDLED_KEYS);
    },
  );

  it('reads back the earlier form (an array of keys): keys only, no times, at most the bound', () => {
    const many = Array.from({ length: HANDLED_KEYS_MAX + 3 }, (_, n) => `k${n}:open`);
    expect(handledKeysFrom(JSON.stringify(['a:open', 1, null, 'b:open']))).toEqual({
      entries: [
        { key: 'a:open', signedAt: null },
        { key: 'b:open', signedAt: null },
      ],
      floor: null,
    });
    expect(keysOf(handledKeysFrom(JSON.stringify(many)))).toEqual(many.slice(-HANDLED_KEYS_MAX));
  });

  it('a deep-frozen list is read, never changed', () => {
    const handled = deepFreeze(handledAll(HANDLED_KEYS_MAX));
    const snapshot = structuredClone(handled);
    withHandled(handled, 'next:open', T + 999);
    expect(handled).toEqual(snapshot);
  });
});

describe('the floor', () => {
  it('a key that falls off the list and comes again is refused', () => {
    const handled = handledAll(HANDLED_KEYS_MAX + 1);
    expect(keysOf(handled)).not.toContain('id-0:open');
    expect(handled.floor).toBe(T);
    expect(wasHandled(handled, 'id-0:open', T)).toBe(true);
    // the same signed push under a new identifier, too
    expect(wasHandled(handled, 'another-id:open', T)).toBe(true);
  });

  it('a key newer than the floor and not in the list is accepted', () => {
    const handled = handledAll(HANDLED_KEYS_MAX + 1);
    expect(wasHandled(handled, 'new:open', T + 1)).toBe(false);
    expect(wasHandled(handled, 'new:open', null)).toBe(false);
  });

  it('is the newest signed time ever dropped, not the last one dropped', () => {
    const times = [T + 100, T + 1, null];
    const handled = handledAll(HANDLED_KEYS_MAX + 3, (n) => (n < 3 ? (times[n] ?? null) : T + n));
    expect(handled.floor).toBe(T + 100);
    expect(wasHandled(handled, 'x:open', T + 100)).toBe(true);
    expect(wasHandled(handled, 'x:open', T + 101)).toBe(false);
  });

  it('a push with no signed time is checked against the list only, and never moves it', () => {
    const handled = handledAll(HANDLED_KEYS_MAX + 2, () => null);
    expect(handled.floor).toBeNull();
    expect(wasHandled(handled, 'id-0:open', T)).toBe(false);
  });

  it('survives a reload of the stored form', () => {
    const storage = memoryStorage();
    const first = handledStoreOver(storage);
    Array.from({ length: HANDLED_KEYS_MAX + 1 }, (_, n) => first.claim(`id-${n}:open`, T + n));
    expect(JSON.parse(storage.items.get(HANDLED_KEYS_ITEM) ?? '{}')).toMatchObject({ floor: T });
    const later = handledStoreOver(storage);
    expect(later.claim('id-0:open', T)).toBe(false);
    expect(later.claim('again:open', T)).toBe(false);
    expect(later.claim('newer:open', T + 1)).toBe(true);
  });

  it.each([
    ['"soon"'],
    ['1.5'],
    ['{}'],
    ['[3]'],
    ['null'],
    ['1e400'],
    [`${Number.MAX_SAFE_INTEGER + 2}`],
  ])('a malformed stored floor %s is read as none, the keys kept', (floor) => {
    const stored = `{"entries":[{"key":"a:open","signedAt":${T}},"b:open"],"floor":${floor}}`;
    expect(handledKeysFrom(stored)).toEqual({
      entries: [
        { key: 'a:open', signedAt: T },
        { key: 'b:open', signedAt: null },
      ],
      floor: null,
    });
    expect(handledStoreOver(memoryStorage({ [HANDLED_KEYS_ITEM]: stored })).claim('c', T)).toBe(
      true,
    );
  });

  it('a malformed stored time is none, and an entry with no key is dropped', () => {
    const stored = JSON.stringify({
      entries: [{ key: 'a', signedAt: 'x' }, { signedAt: T }, { key: 7 }],
      floor: T,
    });
    expect(handledKeysFrom(stored)).toEqual({ entries: [{ key: 'a', signedAt: null }], floor: T });
  });

  it('is forgotten with the list by clear()', () => {
    const storage = memoryStorage();
    const store = handledStoreOver(storage);
    Array.from({ length: HANDLED_KEYS_MAX + 1 }, (_, n) => store.claim(`id-${n}:open`, T + n));
    store.clear();
    expect(storage.items.has(HANDLED_KEYS_ITEM)).toBe(false);
    expect(store.claim('id-0:open', T)).toBe(true);
    expect(handledStoreOver(storage).claim('id-1:open', T + 1)).toBe(true);
  });
});

describe('signedTimeOf', () => {
  it("is the payload's iat, never later than a fresh one may be by the phone's clock", () => {
    expect(signedTimeOf({ iat: T }, T)).toBe(T);
    expect(signedTimeOf({ iat: T - 60 }, T + 0.75)).toBe(T - 60);
    expect(signedTimeOf({ iat: T + 10_000 }, T + 0.75)).toBe(T + PUSH_SIG_MAX_FUTURE_SECONDS);
  });

  it('is none with no payload or no reading of the clock', () => {
    expect(signedTimeOf(null, T)).toBeNull();
    expect(signedTimeOf({ iat: T }, Number.NaN)).toBeNull();
  });
});
