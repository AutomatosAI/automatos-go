// Face ID before approve or answer (D19, KP13): the decision table, every outcome of the installed
// module's error codes, the prompt's options, single-flight under three concurrent calls, a thrown
// error is 'unavailable', the setting on by default and off only after a pass, a refused guard runs
// nothing and a passed one runs once; and, read from the source, only step-up.ts imports
// expo-local-authentication.

import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { importsOf, sources } from '../../push/__tests__/source-files';
import { logger } from '../../lib/logger';
import { createGuard } from '../guard';
import {
  decide,
  ENROLLED_LEVEL,
  GATED_ACTIONS,
  outcomeOf,
  UNGATED_ACTIONS,
  type Outcome,
  type StepUpVerdict,
} from '../policy';
import {
  createStepUpSetting,
  settingRefusalCopy,
  STEP_UP_SETTING_KEY,
  stepUpSetting,
} from '../setting-store';
import { createStepUp, stepUp } from '../step-up';
import {
  STEP_UP_OUTCOME_COPY,
  STEP_UP_PROMPT_COPY,
  STEP_UP_SETTING_COPY,
  STEP_UP_SETTING_REFUSAL_COPY,
} from '../strings';
import {
  fakeAuth,
  installedErrorCodes,
  installedSecurityLevels,
  settingStorage,
  settle,
} from './step-up-fixtures';

// The native module and the app's MMKV store, replaced: step-up.ts and setting-store.ts wire them.
const native = vi.hoisted(() => ({
  options: [] as unknown[],
  result: { success: true } as { success: boolean; error?: string },
  items: new Map<string, string>(),
}));

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: async () => true,
  getEnrolledLevelAsync: async () => 3,
  authenticateAsync: async (options: unknown) => {
    native.options.push(options);
    return native.result;
  },
}));

vi.mock('../../storage/mmkv', () => ({
  appStorage: () => ({
    getItem: (key: string) => native.items.get(key) ?? null,
    setItem: (key: string, value: string) => native.items.set(key, value),
    removeItem: (key: string) => native.items.delete(key),
  }),
}));

const STEP_UP_DIR = path.resolve(__dirname, '..');
const STRONG = ENROLLED_LEVEL.BIOMETRIC_STRONG;
const always = (verdict: StepUpVerdict) => vi.fn(async () => verdict);

let info: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('decide: the decision table (KP13)', () => {
  it.each(GATED_ACTIONS)('%s prompts while the setting is on, passes while it is off', (action) => {
    const phone = { hasHardware: true, enrolledLevel: STRONG };
    expect(decide({ action, settingOn: true, ...phone })).toBe('prompt');
    expect(decide({ action, settingOn: false, ...phone })).toBe('pass_off');
  });

  it.each(UNGATED_ACTIONS)('%s never asks', (action) => {
    for (const settingOn of [true, false]) {
      expect(decide({ action, settingOn, hasHardware: true, enrolledLevel: STRONG })).toBe(
        'pass_not_gated',
      );
    }
  });

  it.each([
    [true, ENROLLED_LEVEL.BIOMETRIC_STRONG, 'prompt'],
    [true, ENROLLED_LEVEL.BIOMETRIC_WEAK, 'prompt'],
    [false, ENROLLED_LEVEL.SECRET, 'prompt'],
    [true, ENROLLED_LEVEL.SECRET, 'prompt'],
    [true, ENROLLED_LEVEL.NONE, 'pass_no_security'],
    [false, ENROLLED_LEVEL.NONE, 'pass_no_security'],
  ] as const)('hardware %s, level %i → %s', (hasHardware, enrolledLevel, expected) => {
    const input = { action: 'answer', settingOn: true, hasHardware, enrolledLevel } as const;
    expect(decide(input)).toBe(expected);
  });

  it('turning the setting off asks whatever the setting says, unless the phone has no security', () => {
    const phone = { hasHardware: true, enrolledLevel: STRONG };
    expect(decide({ action: 'settings_off', settingOn: true, ...phone })).toBe('prompt');
    expect(decide({ action: 'settings_off', settingOn: false, ...phone })).toBe('prompt');
    expect(
      decide({ action: 'settings_off', settingOn: true, hasHardware: true, enrolledLevel: 0 }),
    ).toBe('pass_no_security');
  });

  it("mirrors the installed module's SecurityLevel values", () => {
    expect(installedSecurityLevels()).toMatchObject(ENROLLED_LEVEL);
  });
});

describe('outcomeOf: every result of the installed module', () => {
  const EXPECTED: Readonly<Record<string, Outcome>> = {
    user_cancel: 'cancelled',
    app_cancel: 'cancelled',
    system_cancel: 'cancelled',
    user_fallback: 'cancelled',
    authentication_failed: 'failed',
    timeout: 'failed',
    lockout: 'locked_out',
    not_enrolled: 'unavailable',
    not_available: 'unavailable',
    passcode_not_set: 'unavailable',
    no_space: 'unavailable',
    unable_to_process: 'unavailable',
    unknown: 'unavailable',
    invalid_context: 'unavailable',
  };

  it('a success is passed', () => {
    expect(outcomeOf({ success: true })).toBe('passed');
  });

  it('every error code the typings declare has its outcome', () => {
    const codes = installedErrorCodes();
    expect(codes.length).toBeGreaterThan(10);
    expect([...codes].sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const code of codes) {
      expect(outcomeOf({ success: false, error: code })).toBe(EXPECTED[code]);
    }
  });

  it("iOS's untyped codes and anything new are unavailable, never a pass", () => {
    for (const error of ['missing_usage_description', 'unknown: -1004, Busy', 'brand_new', '']) {
      expect(outcomeOf({ success: false, error })).toBe('unavailable');
    }
  });

  it('every outcome has its line; every refusal says nothing was sent', () => {
    for (const outcome of ['passed', 'cancelled', 'failed', 'locked_out', 'unavailable'] as const) {
      expect(STEP_UP_OUTCOME_COPY[outcome].length).toBeGreaterThan(0);
      if (outcome !== 'passed') expect(STEP_UP_OUTCOME_COPY[outcome]).toContain('Nothing was sent');
    }
    expect(STEP_UP_SETTING_COPY.detail).toContain('on this phone only');
    // every prompted action has a line: iOS refuses an empty reason
    for (const line of Object.values(STEP_UP_PROMPT_COPY)) expect(line.trim()).not.toBe('');
  });
});

describe('stepUp: the phone, read in order, the passcode as the fallback', () => {
  it('reads the hardware, then the level, then prompts with the action’s line', async () => {
    const auth = fakeAuth();
    const gate = createStepUp({ auth: auth.port, settingOn: () => true });
    const verdict = await gate('approve_ticket');
    expect(verdict).toBe('passed');
    expect(info.mock.calls).toEqual([['[step-up] prompt answered', 'passed']]);
    expect(auth.calls).toEqual([
      { op: 'hardware' },
      { op: 'level' },
      {
        op: 'auth',
        options: {
          promptMessage: STEP_UP_PROMPT_COPY.approve_ticket,
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        },
      },
    ]);
  });

  it.each([
    [{ success: false, error: 'user_cancel' }, 'cancelled'],
    [{ success: false, error: 'authentication_failed' }, 'failed'],
    [{ success: false, error: 'lockout' }, 'locked_out'],
    [{ success: false, error: 'not_available' }, 'unavailable'],
  ] as const)('a prompt answered %o is %s', async (result, expected) => {
    const auth = fakeAuth({ result });
    expect(await createStepUp({ auth: auth.port, settingOn: () => true })('answer')).toBe(expected);
  });

  it('an ungated action or a setting that is off reads nothing from the phone', async () => {
    const auth = fakeAuth();
    expect(await createStepUp({ auth: auth.port, settingOn: () => true })('reject')).toBe(
      'pass_not_gated',
    );
    expect(await createStepUp({ auth: auth.port, settingOn: () => false })('answer')).toBe(
      'pass_off',
    );
    expect(auth.calls).toEqual([]);
  });

  it('a phone with no passcode passes without a prompt', async () => {
    const auth = fakeAuth({ hasHardware: false, level: ENROLLED_LEVEL.NONE });
    expect(await createStepUp({ auth: auth.port, settingOn: () => true })('grant_tool')).toBe(
      'pass_no_security',
    );
    expect(auth.prompts()).toBe(0);
  });

  it('a thrown error is unavailable, logged by kind only', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const thrown = fakeAuth({ hardwareThrows: true });
    const rejected = fakeAuth({ result: new Error('LAContext failed') });
    const settingOn = () => true;
    expect(await createStepUp({ auth: thrown.port, settingOn })('answer')).toBe('unavailable');
    expect(await createStepUp({ auth: rejected.port, settingOn })('answer')).toBe('unavailable');
    expect(warn.mock.calls).toEqual([
      ['[step-up] the check failed; nothing is sent'],
      ['[step-up] the check failed; nothing is sent'],
    ]);
  });

  it('single-flight: three concurrent calls share one prompt; the next call asks again', async () => {
    const auth = fakeAuth({ held: true });
    const gate = createStepUp({ auth: auth.port, settingOn: () => true });
    const calls = [gate('answer'), gate('approve_plan'), gate('approve_social')];
    await settle();
    expect(auth.prompts()).toBe(1);
    auth.release({ success: true });
    expect(await Promise.all(calls)).toEqual(['passed', 'passed', 'passed']);
    const next = gate('answer');
    await settle();
    auth.release({ success: false, error: 'user_cancel' });
    expect(await next).toBe('cancelled');
    expect(auth.prompts()).toBe(2);
  });
});

describe('the setting: on by default, off only after a pass (D19)', () => {
  it('reads on when nothing, or anything but "off", is stored, and when the store refuses', () => {
    expect(createStepUpSetting(settingStorage()).isOn()).toBe(true);
    expect(createStepUpSetting(settingStorage({ [STEP_UP_SETTING_KEY]: 'x' })).isOn()).toBe(true);
    const off = settingStorage({ [STEP_UP_SETTING_KEY]: 'off' });
    expect(createStepUpSetting(off).isOn()).toBe(false);
    const locked = settingStorage();
    locked.refuse.read = true;
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    expect(createStepUpSetting(locked).isOn()).toBe(true);
  });

  it('turning it off needs a pass first: a cancel keeps it on, with its line', async () => {
    const store = settingStorage();
    const setting = createStepUpSetting(store);
    const cancelled = always('cancelled');
    const change = await setting.set(false, cancelled);
    expect(cancelled).toHaveBeenCalledExactlyOnceWith('settings_off');
    expect(change).toEqual({ on: true, verdict: 'cancelled' });
    expect(setting.isOn()).toBe(true);
    expect(store.items.get(STEP_UP_SETTING_KEY)).toBeUndefined();
    expect(settingRefusalCopy(change)).toBe(STEP_UP_SETTING_REFUSAL_COPY.cancelled);
  });

  it.each(['passed', 'pass_no_security'] as const)('%s turns it off and saves "off"', async (v) => {
    const store = settingStorage();
    const setting = createStepUpSetting(store);
    const listener = vi.fn();
    setting.subscribe(listener);
    const change = await setting.set(false, always(v));
    expect(change).toEqual({ on: false, verdict: v });
    expect(settingRefusalCopy(change)).toBeNull();
    expect(store.items.get(STEP_UP_SETTING_KEY)).toBe('off');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('turning it on asks nothing', async () => {
    const store = settingStorage({ [STEP_UP_SETTING_KEY]: 'off' });
    const check = always('passed');
    expect(await createStepUpSetting(store).set(true, check)).toEqual({ on: true, verdict: null });
    expect(check).not.toHaveBeenCalled();
    expect(store.items.get(STEP_UP_SETTING_KEY)).toBe('on');
  });

  it('a later change wins over a check still open', async () => {
    const setting = createStepUpSetting(settingStorage());
    let pass: (verdict: StepUpVerdict) => void = () => undefined;
    const held = () =>
      new Promise<StepUpVerdict>((resolve) => {
        pass = resolve;
      });
    const pending = setting.set(false, held);
    await setting.set(true, always('passed'));
    pass('passed');
    expect(await pending).toEqual({ on: true, verdict: 'passed' });
    expect(setting.isOn()).toBe(true);
  });

  it('a check that throws keeps it on; a refused write holds for this launch', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const store = settingStorage();
    const setting = createStepUpSetting(store);
    const throwing = () => Promise.reject(new Error('no prompt'));
    expect(await setting.set(false, throwing)).toEqual({ on: true, verdict: 'unavailable' });
    store.refuse.write = true;
    expect(await setting.set(false, always('passed'))).toEqual({ on: false, verdict: 'passed' });
    expect(store.items.get(STEP_UP_SETTING_KEY)).toBeUndefined();
  });
});

describe('guard: a refusal sends nothing; a pass runs once, at once', () => {
  it.each(['cancelled', 'failed', 'locked_out', 'unavailable'] as const)(
    'a %s guard runs nothing and shows its line',
    async (verdict) => {
      const run = vi.fn(async () => 'sent');
      const notify = vi.fn();
      const result = await createGuard({ check: always(verdict), notify })('answer', run);
      expect(result).toEqual({ ran: false, verdict });
      expect(run).not.toHaveBeenCalled();
      expect(notify).toHaveBeenCalledExactlyOnceWith(STEP_UP_OUTCOME_COPY[verdict]);
    },
  );

  it.each(['passed', 'pass_off', 'pass_no_security', 'pass_not_gated'] as const)(
    'a %s guard runs once and shows nothing',
    async (verdict) => {
      const run = vi.fn(async () => 'sent');
      const notify = vi.fn();
      const result = await createGuard({ check: always(verdict), notify })('answer', run);
      expect(result).toEqual({ ran: true, verdict, value: 'sent' });
      expect(run).toHaveBeenCalledOnce();
      expect(notify).not.toHaveBeenCalled();
    },
  );

  it('never queues: a later pass never sends a cancelled tap; a throwing check sends nothing', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const verdicts: StepUpVerdict[] = ['cancelled', 'passed'];
    const guard = createGuard({ check: async () => verdicts.shift() ?? 'failed', notify: vi.fn() });
    await guard('approve_ticket', first);
    await guard('approve_ticket', second);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    const run = vi.fn();
    const broken = createGuard({ check: () => Promise.reject(new Error('x')), notify: vi.fn() });
    expect(await broken('answer', run)).toEqual({ ran: false, verdict: 'unavailable' });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("the app's gate over the native module and the app's switch", () => {
  it('prompts by default, turns off after a pass, then passes while off', async () => {
    expect(await stepUp('answer')).toBe('passed');
    expect(native.options).toEqual([
      {
        promptMessage: STEP_UP_PROMPT_COPY.answer,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      },
    ]);
    expect(await stepUpSetting.set(false, stepUp)).toEqual({ on: false, verdict: 'passed' });
    expect(native.items.get(STEP_UP_SETTING_KEY)).toBe('off');
    expect(await stepUp('answer')).toBe('pass_off');
    expect(native.options).toHaveLength(2);
    await stepUpSetting.set(true, stepUp);
    native.result = { success: false, error: 'user_cancel' };
    expect(await stepUp('approve_social')).toBe('cancelled');
  });
});

describe('the source', () => {
  const files = sources(STEP_UP_DIR).filter((file) => !file.file.includes('__tests__'));

  it('only step-up.ts imports expo-local-authentication; nothing imports Sentry', () => {
    const importers = files.filter(
      (file) => importsOf(file.text, /^expo-local-authentication$/).length > 0,
    );
    expect(importers.map((file) => path.relative(STEP_UP_DIR, file.file))).toEqual(['step-up.ts']);
    expect(files.filter((file) => importsOf(file.text, /^@sentry\//).length)).toEqual([]);
  });

  it('policy, guard and strings import no React, React Native or Expo', () => {
    for (const name of ['policy.ts', 'guard.ts', 'strings.ts']) {
      const text = files.find((file) => file.file.endsWith(`/${name}`))?.text ?? '';
      expect(importsOf(text, /^(react|react-native|expo-.*|expo)$/)).toEqual([]);
    }
  });

  it("the policy's comment says a notification Reply is not gated (D18)", () => {
    const policy = files.find((file) => file.file.endsWith('/policy.ts'))?.text ?? '';
    expect(policy).toMatch(/notification Reply is not gated \(D18/);
  });
});
