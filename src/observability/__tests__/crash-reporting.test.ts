// Crash reporting's life (R01–R03, KR7) over a fake Sentry and a fake store: start once, only with
// an EU DSN and the switch on; off closes and is remembered; on starts again; the test report is
// one event while on and none while off, and the scrubber removes its planted probes. setUser and
// wrap are on the fake so the tests can prove they are never called.

import type { Event } from '@sentry/react-native';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { logger } from '../../lib/logger';
import { memoryStorage, type KeyValueStorage } from '../../storage/encrypted-storage';
import {
  createCrashReporting,
  TEST_REPORT_MESSAGE,
  TEST_REPORT_PROBES,
  type AppFacts,
  type TestReportContext,
} from '../crash-reporting';
import { CRASH_SETTING_KEY } from '../crash-setting';
import { DEFAULT_ENVIRONMENT, type SentryOptions } from '../options';
import { scrubEvent } from '../scrub';

const EU_DSN = 'https://public@o123.ingest.de.sentry.io/456';
const US_DSN = 'https://public@o123.ingest.us.sentry.io/456';
const APP: AppFacts = { channel: 'testflight', appVersion: '1.0.0', buildNumber: '12' };

let warn: MockInstance<typeof logger.warn>;

beforeEach(() => {
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
});

function fakeSentry() {
  return {
    init: vi.fn((options: SentryOptions) => {
      expect(options.dsn).not.toBe('');
    }),
    close: vi.fn(async () => undefined),
    captureMessage: vi.fn((message: string, context: TestReportContext) => {
      expect([message, context.level]).toEqual([TEST_REPORT_MESSAGE, 'info']);
      return 'event-id';
    }),
    setUser: vi.fn(),
    wrap: vi.fn(),
  };
}

type Setup = {
  readonly dsn?: string;
  readonly saved?: string;
  readonly app?: AppFacts;
  readonly store?: KeyValueStorage;
};

function setup({ dsn = EU_DSN, saved, app = APP, store = memoryStorage() }: Setup = {}) {
  if (saved !== undefined) store.setItem(CRASH_SETTING_KEY, saved);
  const sentry = fakeSentry();
  const reporting = createCrashReporting({
    sentry,
    storage: () => store,
    env: { sentryDsn: dsn },
    app,
  });
  return { sentry, store, reporting };
}

function initOptions(sentry: ReturnType<typeof fakeSentry>): SentryOptions {
  const [call] = sentry.init.mock.calls;
  if (!call) throw new Error('Sentry.init was not called');
  return call[0];
}

describe('init', () => {
  it('starts Sentry once with the options buildSentryOptions makes; a second init is a no-op', () => {
    const { sentry, reporting } = setup();
    reporting.init();
    reporting.init();
    expect(sentry.init).toHaveBeenCalledTimes(1);
    const options = initOptions(sentry);
    expect(options).toMatchObject({
      dsn: EU_DSN,
      environment: 'testflight',
      release: 'com.automatos.app@1.0.0+12',
      dist: '12',
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
    expect(options.beforeSend).toBe(scrubEvent);
  });

  it('adds no integration: no navigation or touch tracking is wired (KR7)', () => {
    const { sentry, reporting } = setup();
    reporting.init();
    const options = initOptions(sentry);
    expect('integrations' in options).toBe(false);
    expect('defaultIntegrations' in options).toBe(false);
  });

  it('does not start with no DSN, a non-EU DSN or the switch off', () => {
    for (const run of [setup({ dsn: '' }), setup({ dsn: US_DSN }), setup({ saved: 'off' })]) {
      run.reporting.init();
      expect(run.sentry.init).not.toHaveBeenCalled();
    }
  });

  it('starts by default on a fresh install (nothing saved)', () => {
    const { sentry, reporting } = setup();
    expect(reporting.isEnabled()).toBe(true);
    reporting.init();
    expect(sentry.init).toHaveBeenCalledTimes(1);
  });

  it('names a build with no channel or version development and unknown', () => {
    const { sentry, reporting } = setup({
      app: { channel: null, appVersion: ' ', buildNumber: null },
    });
    reporting.init();
    expect(initOptions(sentry)).toMatchObject({
      environment: DEFAULT_ENVIRONMENT,
      release: 'com.automatos.app@unknown',
    });
    expect('dist' in initOptions(sentry)).toBe(false);
  });

  it('survives an SDK that throws on start, and then sends nothing', () => {
    const { sentry, reporting } = setup();
    sentry.init.mockImplementationOnce(() => {
      throw new Error('native SDK missing');
    });
    expect(() => reporting.init()).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[crash-reports] Sentry did not start', expect.any(Error));
    expect(reporting.sendTestReport()).toBe(false);
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('is off, and starts nothing, when the switch cannot be read', () => {
    const store: KeyValueStorage = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('mmkv read failed');
      },
    };
    const { sentry, reporting } = setup({ store });
    reporting.init();
    expect(reporting.isEnabled()).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
  });
});

describe('setEnabled', () => {
  it('on → off closes Sentry and saves the choice for the next launch', async () => {
    const { sentry, store, reporting } = setup();
    reporting.init();
    await reporting.setEnabled(false);
    expect(sentry.close).toHaveBeenCalledTimes(1);
    expect(reporting.isEnabled()).toBe(false);
    expect(store.getItem(CRASH_SETTING_KEY)).toBe('off');
    const nextLaunch = setup({ store });
    nextLaunch.reporting.init();
    expect(nextLaunch.sentry.init).not.toHaveBeenCalled();
  });

  it('off → on saves the choice and starts Sentry', async () => {
    const { sentry, store, reporting } = setup({ saved: 'off' });
    reporting.init();
    expect(sentry.init).not.toHaveBeenCalled();
    await reporting.setEnabled(true);
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(reporting.isEnabled()).toBe(true);
    expect(store.getItem(CRASH_SETTING_KEY)).toBe('on');
  });

  it('runs quick changes in order: close finishes before Sentry starts again', async () => {
    const { sentry, reporting } = setup();
    reporting.init();
    const order: string[] = [];
    sentry.close.mockImplementationOnce(async () => {
      await Promise.resolve();
      order.push('close');
    });
    sentry.init.mockImplementationOnce(() => {
      order.push('init');
    });
    const off = reporting.setEnabled(false);
    const on = reporting.setEnabled(true);
    await Promise.all([off, on]);
    expect(order).toEqual(['close', 'init']);
    expect(sentry.init).toHaveBeenCalledTimes(2);
  });

  it('turning off when Sentry never started closes nothing', async () => {
    const { sentry, reporting } = setup({ dsn: '' });
    reporting.init();
    await reporting.setEnabled(false);
    expect(sentry.close).not.toHaveBeenCalled();
  });

  it('turning on with no DSN saves the choice and starts nothing', async () => {
    const { sentry, store, reporting } = setup({ dsn: '', saved: 'off' });
    await reporting.setEnabled(true);
    expect(store.getItem(CRASH_SETTING_KEY)).toBe('on');
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('a close that fails still leaves reporting off', async () => {
    const { sentry, reporting } = setup();
    reporting.init();
    sentry.close.mockRejectedValueOnce(new Error('flush timed out'));
    await expect(reporting.setEnabled(false)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      '[crash-reports] Sentry did not close cleanly',
      expect.any(Error),
    );
    expect(reporting.sendTestReport()).toBe(false);
  });
});

describe('sendTestReport', () => {
  it('captures exactly one event while on, with the planted probes in extra', () => {
    const { sentry, reporting } = setup();
    reporting.init();
    expect(reporting.sendTestReport()).toBe(true);
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(sentry.captureMessage).toHaveBeenCalledWith(TEST_REPORT_MESSAGE, {
      level: 'info',
      extra: TEST_REPORT_PROBES,
    });
  });

  it('captures nothing while off, with no DSN or before init', async () => {
    const off = setup({ saved: 'off' });
    off.reporting.init();
    const noDsn = setup({ dsn: '' });
    noDsn.reporting.init();
    const notStarted = setup();
    for (const run of [off, noDsn, notStarted]) {
      expect(run.reporting.sendTestReport()).toBe(false);
      expect(run.sentry.captureMessage).not.toHaveBeenCalled();
    }
  });

  it('captures nothing once the switch goes off, even before close has finished', async () => {
    const { sentry, reporting } = setup();
    reporting.init();
    const off = reporting.setEnabled(false);
    expect(reporting.sendTestReport()).toBe(false);
    await off;
    expect(reporting.sendTestReport()).toBe(false);
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('answers false, without throwing, when the SDK fails to capture', () => {
    const { sentry, reporting } = setup();
    reporting.init();
    sentry.captureMessage.mockImplementationOnce(() => {
      throw new Error('transport gone');
    });
    expect(reporting.sendTestReport()).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      '[crash-reports] the test report was not captured',
      expect.any(Error),
    );
  });

  it('the probes are fake, and the scrubber removes every one of them from the event', () => {
    const { sentry, reporting } = setup();
    reporting.init();
    reporting.sendTestReport();
    const [message, context] = sentry.captureMessage.mock.calls[0] ?? [];
    const event: Event = { message, level: context?.level, extra: { ...context?.extra } };
    const sent = JSON.stringify(initOptions(sentry).beforeSend?.(event as never, {}));
    for (const probe of Object.values(TEST_REPORT_PROBES)) {
      expect(probe).toMatch(/PROBE/);
      expect(sent).not.toContain(probe);
    }
    expect(sent).not.toMatch(/question_text|chat_text|call_id/);
    expect(sent).toContain(TEST_REPORT_MESSAGE);
  });
});

describe('the SDK calls it never makes', () => {
  it('never calls setUser or wrap, whatever the user does', async () => {
    const { sentry, reporting } = setup();
    reporting.init();
    reporting.sendTestReport();
    await reporting.setEnabled(false);
    await reporting.setEnabled(true);
    reporting.sendTestReport();
    expect(sentry.setUser).not.toHaveBeenCalled();
    expect(sentry.wrap).not.toHaveBeenCalled();
  });
});
