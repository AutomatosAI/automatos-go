// What the system shows (US-014b): the five categories W2 names and their actions exactly (KP7: no
// Approve, no option button, every action opens the app); the three Android channels, PRIVATE, with
// W2's channel ids (KP20); setup over a fake port (channels on Android only and first, a failing
// call survived, a second run the same); the foreground presentation table and its verify budget
// (KP14, KP15); and, read from the source, expo-notifications imported by platform/expo.ts only.

import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger';
import { FOREGROUND_VERIFY_TIMEOUT_MS } from '../config';
import {
  OPEN_CATEGORY_ID,
  PUSH_CATEGORIES,
  QUESTION_CATEGORY_IDS,
  isQuestionCategory,
} from '../platform/categories';
import { PUSH_CHANNELS } from '../platform/channels';
import { SHOW_NOTHING, presentationFor, verifiedWithin } from '../platform/foreground';
import { setupNotificationPlatform } from '../platform/setup';
import {
  EXPECTED_CATEGORY_CALLS,
  EXPECTED_CHANNEL_CALLS,
  OPEN,
  QUESTION_OPTIONS,
  REPLY,
  fakePort,
  type Call,
} from './platform-fixtures';
import { importsOf, sources } from './source-files';

const ROOT = path.resolve(__dirname, '../../..');
const PUSH_DIR = path.join(ROOT, 'src', 'push');
const PLATFORM_DIR = path.join(PUSH_DIR, 'platform');

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('categories (KP7 = W2 K9)', () => {
  it('registers the five categories W2 names, each with its actions exactly', () => {
    expect(PUSH_CATEGORIES).toEqual([
      { identifier: 'automatos.question.0', actions: [REPLY, OPEN], options: QUESTION_OPTIONS },
      { identifier: 'automatos.question.1', actions: [REPLY, OPEN], options: QUESTION_OPTIONS },
      { identifier: 'automatos.question.2', actions: [REPLY, OPEN], options: QUESTION_OPTIONS },
      { identifier: 'automatos.question.3', actions: [REPLY, OPEN], options: QUESTION_OPTIONS },
      {
        identifier: 'automatos.open',
        actions: [OPEN],
        options: { previewPlaceholder: 'Automatos Go' },
      },
    ]);
    expect(QUESTION_CATEGORY_IDS).toEqual(PUSH_CATEGORIES.slice(0, 4).map((c) => c.identifier));
    expect(OPEN_CATEGORY_ID).toBe('automatos.open');
  });

  it('offers no Approve, no option button, and every action opens the app', () => {
    const actions = PUSH_CATEGORIES.flatMap((category) => category.actions);
    expect(new Set(actions.map((action) => action.identifier))).toEqual(new Set(['reply', 'open']));
    for (const action of actions) {
      expect(action.options.opensAppToForeground).toBe(true);
      expect(Object.keys(action.options)).not.toContain('isDestructive');
    }
    const replies = actions.filter((action) => action.identifier === 'reply');
    expect(replies).toHaveLength(4);
    expect(replies.every((action) => action.options.isAuthenticationRequired === true)).toBe(true);
    expect(actions.filter((a) => a.textInput !== undefined)).toEqual(replies);
  });

  it("uses no ':' or '-' in an identifier (expo-notifications' setNotificationCategoryAsync)", () => {
    expect(PUSH_CATEGORIES.filter((c) => /[:-]/.test(c.identifier))).toEqual([]);
  });

  it('is frozen all the way down', () => {
    expect(Object.isFrozen(PUSH_CATEGORIES)).toBe(true);
    for (const category of PUSH_CATEGORIES) {
      expect(Object.isFrozen(category)).toBe(true);
      expect(Object.isFrozen(category.actions)).toBe(true);
      expect(Object.isFrozen(category.options)).toBe(true);
      expect(category.actions.every((a) => Object.isFrozen(a) && Object.isFrozen(a.options))).toBe(
        true,
      );
    }
  });

  it.each([
    ['automatos.question.0', true],
    ['automatos.question.3', true],
    ['automatos.open', false],
    ['automatos.questions', false],
    ['', false],
    [null, false],
  ])('isQuestionCategory(%j) is %s', (category, expected) => {
    expect(isQuestionCategory(category)).toBe(expected);
  });
});

describe('Android channels (KP20 = W2 channel_id)', () => {
  it("are W2's three ids, each PRIVATE on a locked screen and allowed to badge", () => {
    expect(PUSH_CHANNELS).toEqual([
      {
        id: 'questions',
        name: 'Questions',
        importance: 'HIGH',
        lockscreenVisibility: 'PRIVATE',
        showBadge: true,
      },
      {
        id: 'review',
        name: 'Ready for review',
        importance: 'DEFAULT',
        lockscreenVisibility: 'PRIVATE',
        showBadge: true,
      },
      {
        id: 'auto',
        name: 'Auto',
        importance: 'DEFAULT',
        lockscreenVisibility: 'PRIVATE',
        showBadge: true,
      },
    ]);
    expect(Object.isFrozen(PUSH_CHANNELS)).toBe(true);
    expect(PUSH_CHANNELS.every((channel) => Object.isFrozen(channel))).toBe(true);
  });
});

describe('setupNotificationPlatform', () => {
  it('on Android registers every channel first, then every category, and nothing else', async () => {
    const { port, calls } = fakePort();
    const outcome = await setupNotificationPlatform(port, 'android');
    expect(calls).toEqual([...EXPECTED_CHANNEL_CALLS, ...EXPECTED_CATEGORY_CALLS]);
    expect(outcome).toEqual({ ok: true, failedChannels: 0, failedCategories: 0 });
  });

  it('on iOS registers every category and no channel', async () => {
    const { port, calls } = fakePort();
    const outcome = await setupNotificationPlatform(port, 'ios');
    expect(calls).toEqual(EXPECTED_CATEGORY_CALLS);
    expect(outcome).toEqual({ ok: true, failedChannels: 0, failedCategories: 0 });
  });

  it('finishes every channel before the first category starts', async () => {
    let releaseChannels: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseChannels = resolve;
    });
    const order: string[] = [];
    const { port } = fakePort({
      setNotificationChannelAsync: async (id) => {
        await gate;
        order.push(`channel ${id}`);
      },
      setNotificationCategoryAsync: async (id) => {
        order.push(`category ${id}`);
      },
    });
    const running = setupNotificationPlatform(port, 'android');
    await new Promise((resolve) => setImmediate(resolve));
    expect(order).toEqual([]);
    releaseChannels();
    await running;
    expect(order.slice(0, 3)).toEqual(['channel questions', 'channel review', 'channel auto']);
    expect(order).toHaveLength(8);
  });

  it('survives a rejected and a throwing call, registers the rest and logs counts only', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const registered: string[] = [];
    const { port } = fakePort({
      setNotificationChannelAsync: async (id) => {
        if (id === 'review') throw new Error('channel refused');
        registered.push(id);
      },
      setNotificationCategoryAsync: (id) => {
        if (id === 'automatos.question.2') throw new Error('not a promise');
        registered.push(id);
        return Promise.resolve(null);
      },
    });
    const outcome = await setupNotificationPlatform(port, 'android');
    expect(outcome).toEqual({ ok: false, failedChannels: 1, failedCategories: 1 });
    expect(registered).toEqual([
      'questions',
      'auto',
      'automatos.question.0',
      'automatos.question.1',
      'automatos.question.3',
      'automatos.open',
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[push] platform setup failed', {
      channels: 1,
      categories: 1,
    });
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/refused|not a promise|automatos\./);
  });

  it('resolves when every call fails, and logs nothing when all succeed', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const fail = () => Promise.reject(new Error('down'));
    const failing = fakePort({
      setNotificationChannelAsync: fail,
      setNotificationCategoryAsync: fail,
    });
    await expect(setupNotificationPlatform(failing.port, 'android')).resolves.toEqual({
      ok: false,
      failedChannels: 3,
      failedCategories: 5,
    });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockClear();
    await setupNotificationPlatform(fakePort().port, 'android');
    expect(warn).not.toHaveBeenCalled();
  });

  it('is idempotent: a second run makes the same calls and leaves the same state', async () => {
    const { port, calls } = fakePort();
    await setupNotificationPlatform(port, 'android');
    const first = [...calls];
    await setupNotificationPlatform(port, 'android');
    expect(calls.slice(first.length)).toEqual(first);
    const state = (list: Call[]) =>
      new Map(list.map(([method, id, ...rest]) => [`${method} ${String(id)}`, rest]));
    expect(state(calls)).toEqual(state(first));
  });
});

describe('presentationFor (KP14, KP15)', () => {
  const QUESTION = 'automatos.question.2';
  const shown = (banner: boolean, sound: boolean) => ({
    shouldShowBanner: banner,
    shouldShowList: true,
    shouldPlaySound: sound,
    shouldSetBadge: false,
  });

  it.each([
    // verified, category, onScreen → what shows
    [false, QUESTION, false, SHOW_NOTHING],
    [false, QUESTION, true, SHOW_NOTHING],
    [false, 'automatos.open', false, SHOW_NOTHING],
    [false, null, false, SHOW_NOTHING],
    [true, QUESTION, false, shown(true, true)],
    [true, 'automatos.question.0', false, shown(true, true)],
    [true, 'automatos.open', false, shown(true, false)],
    [true, null, false, shown(true, false)],
    [true, 'something.else', false, shown(true, false)],
    [true, QUESTION, true, shown(false, false)],
    [true, 'automatos.open', true, shown(false, false)],
  ])('verified %s, category %j, on screen %s', (verified, category, onScreen, expected) => {
    expect(presentationFor({ verified, category, onScreen })).toEqual(expected);
  });

  it('shows nothing at all when unverified, and never sets the badge', () => {
    expect(SHOW_NOTHING).toEqual({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
    for (const verified of [true, false]) {
      for (const onScreen of [true, false]) {
        const presentation = presentationFor({ verified, category: QUESTION, onScreen });
        expect(presentation.shouldSetBadge).toBe(false);
        expect(Object.isFrozen(presentation)).toBe(true);
      }
    }
  });
});

describe('verifiedWithin: the foreground verify budget', () => {
  it('is 2 seconds', () => {
    expect(FOREGROUND_VERIFY_TIMEOUT_MS).toBe(2000);
  });

  it.each([
    ['true', () => Promise.resolve(true), true],
    ['false', () => Promise.resolve(false), false],
    ['a rejection', () => Promise.reject(new Error('bad key')), false],
    [
      'a synchronous throw',
      () => {
        throw new Error('no key');
      },
      false,
    ],
    ['a truthy non-boolean', () => Promise.resolve('yes' as unknown as boolean), false],
  ])('answers %s as %s', async (_label, check, expected) => {
    await expect(verifiedWithin(check)).resolves.toBe(expected);
  });

  it('counts a check slower than FOREGROUND_VERIFY_TIMEOUT_MS as unverified', async () => {
    vi.useFakeTimers();
    let settled: boolean | undefined;
    const running = verifiedWithin(() => new Promise<boolean>(() => undefined)).then((v) => {
      settled = v;
      return v;
    });
    await vi.advanceTimersByTimeAsync(FOREGROUND_VERIFY_TIMEOUT_MS - 1);
    expect(settled).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await expect(running).resolves.toBe(false);
  });

  it('keeps an answer that comes in time and leaves no timer behind', async () => {
    vi.useFakeTimers();
    const running = verifiedWithin(
      () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 1500)),
    );
    await vi.advanceTimersByTimeAsync(1500);
    await expect(running).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('read from the source', () => {
  const appSources = [...sources(path.join(ROOT, 'src')), ...sources(path.join(ROOT, 'app'))];
  const relative = (file: string) => path.relative(ROOT, file);

  it('only src/push/platform/expo.ts imports expo-notifications', () => {
    const importers = appSources
      .filter(({ text }) => importsOf(text, /^expo-notifications(?:\/.*)?$/).length > 0)
      .map(({ file }) => relative(file));
    expect(importers).toEqual([path.join('src', 'push', 'platform', 'expo.ts')]);
  });

  it('no test imports platform/expo', () => {
    const tests = appSources.filter(({ file }) => file.includes(`${path.sep}__tests__${path.sep}`));
    expect(tests.filter(({ text }) => importsOf(text, /platform\/expo$/).length > 0)).toEqual([]);
  });

  it('the other platform modules import no react, react-native or expo-*', () => {
    const pure = sources(PLATFORM_DIR).filter(({ file }) => !file.endsWith(`${path.sep}expo.ts`));
    expect(pure.length).toBeGreaterThanOrEqual(5);
    const native = /^(react|react-native|expo)(?:[-/].*)?$|^@expo\//;
    expect(pure.filter(({ text }) => importsOf(text, native).length > 0)).toEqual([]);
  });

  it('nothing in the wave turns opensAppToForeground off', () => {
    const waveCode = sources(PUSH_DIR).filter(({ file }) => !file.includes('__tests__'));
    expect(waveCode.filter(({ text }) => /opensAppToForeground:\s*false/.test(text))).toEqual([]);
  });
});
