// PushRoot's pure parts (US-014g): the in-context ask's policy table (KP11: only at 'ask', once
// something waits or from the second session, at most twice, a week apart), its counters in MMKV
// (numbers and dates only), the badge from the needs-you total and from none (KP14), and the local
// teardown: every step once, in order, past a failing one, never rejecting (KP18).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { badgeCount } from '../badge';
import { PROMPT_COOLDOWN_MS, PROMPT_COUNTS_ITEM } from '../config';
import { NO_PROMPT_COUNTS, promptCountsFrom, promptMemoryOver } from '../prompt/memory';
import { offerPrompt, type PromptInput } from '../prompt/policy';
import type { PushStatus } from '../registration/state';
import { teardownLocal, type TeardownDeps } from '../teardown';
import { memoryStorage } from './handler-fixtures';
import { importsOf, sources } from './source-files';

const NOW = 1_792_540_800_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ASK: PushStatus = { kind: 'ask' };

const base: PromptInput = {
  status: ASK,
  sessionCount: 1,
  needsYouTotal: 0,
  lastDeclinedAt: null,
  declines: 0,
  now: NOW,
};

describe('offerPrompt: the in-context ask (KP11)', () => {
  it.each<[string, boolean, Partial<PromptInput>]>([
    ['the first session with nothing waiting', false, {}],
    ['the first session once something waits', true, { needsYouTotal: 3 }],
    ['the second session', true, { sessionCount: 2 }],
    ['a later session', true, { sessionCount: 9 }],
    ['before the first registration run', false, { status: null, needsYouTotal: 3 }],
    ['already on', false, { status: { kind: 'on' }, needsYouTotal: 3 }],
    ['denied in the OS', false, { status: { kind: 'denied' }, sessionCount: 4 }],
    ['a server that does not push', false, { status: { kind: 'unsupported' }, sessionCount: 4 }],
    ['an operator who said no', false, { status: { kind: 'operator_off' }, sessionCount: 4 }],
    ['granted, not registered yet', false, { status: { kind: 'off', reason: 'other' } }],
    [
      'one decline three days ago',
      false,
      { sessionCount: 3, declines: 1, lastDeclinedAt: NOW - 3 * DAY_MS },
    ],
    [
      'one decline just under a week ago',
      false,
      { sessionCount: 3, declines: 1, lastDeclinedAt: NOW - PROMPT_COOLDOWN_MS + 1 },
    ],
    [
      'one decline a week ago',
      true,
      { sessionCount: 3, declines: 1, lastDeclinedAt: NOW - PROMPT_COOLDOWN_MS },
    ],
    [
      'two declines, long ago: only Settings offers it',
      false,
      { sessionCount: 9, needsYouTotal: 5, declines: 2, lastDeclinedAt: NOW - 90 * DAY_MS },
    ],
    [
      'a decline dated ahead of the clock',
      false,
      { sessionCount: 3, declines: 1, lastDeclinedAt: NOW + DAY_MS },
    ],
  ])('%s → %s', (_name, offered, input) => {
    expect(offerPrompt({ ...base, ...input })).toBe(offered);
  });
});

describe('the ask counters (MMKV: numbers and dates only)', () => {
  it('counts a session once per memory, and a new memory counts the next session', () => {
    const storage = memoryStorage();
    const first = promptMemoryOver(storage);
    expect(first.countSession().sessions).toBe(1);
    expect(first.countSession().sessions).toBe(1);
    expect(promptMemoryOver(storage).countSession().sessions).toBe(2);
    expect(JSON.parse(storage.items.get(PROMPT_COUNTS_ITEM) ?? 'null')).toEqual({
      sessions: 2,
      declines: 0,
      lastDeclinedAt: null,
    });
  });

  it("notes each 'Not now' with its date; clear() forgets everything", () => {
    const storage = memoryStorage();
    const memory = promptMemoryOver(storage);
    memory.countSession();
    expect(memory.noteDecline(NOW)).toEqual({ sessions: 1, declines: 1, lastDeclinedAt: NOW });
    expect(promptMemoryOver(storage).read()).toEqual({
      sessions: 1,
      declines: 1,
      lastDeclinedAt: NOW,
    });
    memory.clear();
    expect(storage.items.has(PROMPT_COUNTS_ITEM)).toBe(false);
    expect(memory.read()).toEqual(NO_PROMPT_COUNTS);
  });

  it.each([null, '', 'not json', '[]', '{"sessions":-1,"declines":"two","lastDeclinedAt":1.5}'])(
    'an unreadable item (%j) reads as none of what it cannot read',
    (stored) => {
      expect(promptCountsFrom(stored)).toEqual(NO_PROMPT_COUNTS);
    },
  );

  it('a store that throws still counts for this launch, and says so', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const broken = {
      getItem: () => {
        throw new Error('no MMKV');
      },
      setItem: () => {
        throw new Error('no MMKV');
      },
      removeItem: () => {
        throw new Error('no MMKV');
      },
    };
    const memory = promptMemoryOver(broken);
    expect(memory.countSession().sessions).toBe(1);
    expect(memory.noteDecline(NOW).declines).toBe(1);
    expect(() => memory.clear()).not.toThrow();
    expect(memory.read()).toEqual(NO_PROMPT_COUNTS);
    expect(warn).toHaveBeenCalledTimes(4);
    warn.mockRestore();
  });
});

describe('the badge (KP14)', () => {
  it.each<[number | null | undefined, number]>([
    [4, 4],
    [1, 1],
    [0, 0],
    [undefined, 0],
    [null, 0],
    [-2, 0],
    [2.5, 0],
    [Number.NaN, 0],
  ])('a total of %s → %s', (total, count) => {
    expect(badgeCount(total)).toBe(count);
  });
});

/** Teardown's deps over fakes; a name in `failing` rejects (async steps) or throws (sync ones). */
function fakes(failing: ReadonlySet<string> = new Set()) {
  const calls: string[] = [];
  const syncStep = (name: string): void => {
    calls.push(name);
    if (failing.has(name)) throw new Error(`${name} threw`);
  };
  const asyncStep = (name: string): Promise<void> => {
    calls.push(name);
    return failing.has(name) ? Promise.reject(new Error(`${name} failed`)) : Promise.resolve();
  };
  const deps: TeardownDeps = {
    store: { clear: () => asyncStep('store.clear') },
    port: {
      // a native call that throws before its promise
      setBadgeCountAsync: (count) => {
        syncStep(`setBadgeCountAsync(${count})`);
        return Promise.resolve(true);
      },
      dismissAllNotificationsAsync: () => asyncStep('dismissAllNotificationsAsync'),
    },
    handled: { clear: () => syncStep('handled.clear') },
    prompt: { clear: () => syncStep('prompt.clear') },
  };
  return { calls, deps };
}

const EVERY_STEP = [
  'store.clear',
  'setBadgeCountAsync(0)',
  'dismissAllNotificationsAsync',
  'handled.clear',
  'prompt.clear',
];

describe('teardownLocal (KP18)', () => {
  it('clears the push record, the badge, the delivered notifications, the handled keys and the counters, once each', async () => {
    const { calls, deps } = fakes();
    expect(await teardownLocal(deps)).toEqual({ failed: [] });
    expect(calls).toEqual(EVERY_STEP);
  });

  it('runs every step past a rejecting and a throwing one, and names them', async () => {
    const { calls, deps } = fakes(new Set(['store.clear', 'setBadgeCountAsync(0)']));
    expect(await teardownLocal(deps)).toEqual({ failed: ['push_record', 'badge'] });
    expect(calls).toEqual(EVERY_STEP);
  });

  it('never rejects, even when every step fails', async () => {
    const { calls, deps } = fakes(new Set(EVERY_STEP));
    await expect(teardownLocal(deps)).resolves.toEqual({
      failed: ['push_record', 'badge', 'delivered', 'handled', 'prompt_counts'],
    });
    expect(calls).toEqual(EVERY_STEP);
  });
});

describe("PushRoot's logic modules stay pure", () => {
  const PURE = [
    'session.ts',
    'wiring.ts',
    'teardown.ts',
    'inbound/receive.ts',
    'prompt/policy.ts',
    'prompt/memory.ts',
  ];

  it('import no React, React Native or Expo module (natives.ts and PushRoot bind them)', () => {
    const files = sources(path.resolve(__dirname, '..')).filter(({ file }) =>
      PURE.some((name) => file.endsWith(`${path.sep}push${path.sep}${name}`)),
    );
    expect(files).toHaveLength(PURE.length);
    const native = files.flatMap(({ text }) =>
      importsOf(text, /^(react|react-native|expo)(-|\/|$)/),
    );
    expect(native).toEqual([]);
  });

  it('the badge is the needs-you number: useNeedsYou, never a second fetch of its route', () => {
    const badge = readFileSync(path.resolve(__dirname, '../badge.ts'), 'utf8');
    expect(badge).toMatch(/useNeedsYou\(\)/);
    expect(badge).toMatch(/setBadgeCountAsync\(count\)/);
    expect(badge).not.toMatch(/fetchNeedsYou|routes\.needsYou|useQuery\(/);
    expect(importsOf(badge, /api\/(client|routes)$|@tanstack/)).toEqual([]);
  });
});
