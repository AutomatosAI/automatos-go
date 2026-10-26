// The Sentry options as fixed policy (D44, KR7): EU only, the user's switch, no PII, no tracing,
// no screenshots, view hierarchy or replays, no failed-request events, and the scrubber wired as
// beforeSend and beforeBreadcrumb. Every 'off' in options.ts carries its reason on the same line.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildSentryOptions,
  DEFAULT_ENVIRONMENT,
  isEuDsn,
  MAX_BREADCRUMBS,
  RELEASE_PREFIX,
  releaseName,
  type SentryOptionsInput,
} from '../options';
import { scrubBreadcrumb, scrubEvent } from '../scrub';

const EU_DSN = 'https://0123456789abcdef0123456789abcdef@o123.ingest.de.sentry.io/4508123456789';
const ROOT = path.resolve(__dirname, '../../..');

const INPUT: SentryOptionsInput = Object.freeze({
  dsn: EU_DSN,
  enabled: true,
  channel: 'testflight',
  appVersion: '1.0.0',
  buildNumber: '12',
});

function build(overrides: Partial<SentryOptionsInput> = {}) {
  return buildSentryOptions({ ...INPUT, ...overrides });
}

describe('isEuDsn', () => {
  it("accepts a DSN for an org's EU ingest host", () => {
    expect(isEuDsn(EU_DSN)).toBe(true);
    expect(isEuDsn('https://abc@o1.ingest.de.sentry.io/1')).toBe(true);
    expect(isEuDsn('https://abc@O1.INGEST.DE.SENTRY.IO/1')).toBe(true);
  });

  it.each([
    ['sentry.io', 'https://abc@sentry.io/1'],
    ['us.sentry.io', 'https://abc@us.sentry.io/1'],
    ['the US ingest host', 'https://abc@o1.ingest.us.sentry.io/1'],
    ['ingest.sentry.io', 'https://abc@o1.ingest.sentry.io/1'],
    ['the bare EU ingest host', 'https://abc@ingest.de.sentry.io/1'],
    ['the look-alike ingest.de.sentry.io.evil.test', 'https://abc@ingest.de.sentry.io.evil.test/1'],
    ['a look-alike with an org', 'https://abc@o1.ingest.de.sentry.io.evil.test/1'],
    ['the EU host only in the path', 'https://abc@evil.test/o1.ingest.de.sentry.io/1'],
    ['a second @', 'https://abc@o1.ingest.de.sentry.io@evil.test/1'],
    ['plain http', 'http://abc@o1.ingest.de.sentry.io/1'],
    ['no public key', 'https://o1.ingest.de.sentry.io/1'],
    ['no project', 'https://abc@o1.ingest.de.sentry.io'],
    ['an empty string', ''],
    ['not a URL', 'o1.ingest.de.sentry.io'],
  ])('refuses %s', (_name, dsn) => {
    expect(isEuDsn(dsn)).toBe(false);
  });
});

describe('buildSentryOptions: when nothing may be sent', () => {
  it.each([
    ['the switch is off', { enabled: false }],
    ['the DSN is empty', { dsn: '' }],
    ['the DSN is blank', { dsn: '   ' }],
    ['the DSN is not EU', { dsn: 'https://abc@o1.ingest.us.sentry.io/1' }],
    ['the DSN is a look-alike', { dsn: 'https://abc@o1.ingest.de.sentry.io.evil.test/1' }],
    ['the DSN is malformed', { dsn: 'not a dsn' }],
  ])('is null when %s', (_name, overrides: Partial<SentryOptionsInput>) => {
    expect(build(overrides)).toBeNull();
  });
});

describe('buildSentryOptions: the fixed options (KR7)', () => {
  it('turns off PII, tracing, screenshots, the view hierarchy, replays and failed requests', () => {
    expect(build()).toMatchObject({
      sendDefaultPii: false,
      tracesSampleRate: 0,
      enableAutoPerformanceTracing: false,
      enableUserInteractionTracing: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      enableCaptureFailedRequests: false,
      maxBreadcrumbs: MAX_BREADCRUMBS,
    });
    expect(MAX_BREADCRUMBS).toBe(30);
  });

  it('turns off each tracer a rate of 0 would still install (integrations/default.js)', () => {
    expect(build()).toMatchObject({
      enableAppStartTracking: false,
      enableNativeFramesTracking: false,
      enableStallTracking: false,
      tracePropagationTargets: [],
    });
    expect(build()).not.toHaveProperty('profilesSampleRate');
    expect(build()).not.toHaveProperty('tracesSampler');
  });

  it('turns off sessions, logs and the debug sidecar', () => {
    expect(build()).toMatchObject({
      enableAutoSessionTracking: false,
      enableLogs: false,
      spotlight: false,
    });
  });

  it('keeps iOS native breadcrumbs out of native crashes, which never pass beforeSend', () => {
    expect(build()).toMatchObject({
      enableAutoBreadcrumbTracking: false,
      enableNetworkBreadcrumbs: false,
    });
  });

  it('wires the scrubber as beforeSend and beforeBreadcrumb', () => {
    const options = build();
    expect(options?.beforeSend).toBe(scrubEvent);
    expect(options?.beforeBreadcrumb).toBe(scrubBreadcrumb);
  });

  it('sets nothing else: no integrations, no tracing callbacks, no user', () => {
    expect(Object.keys(build() ?? {}).sort()).toEqual(
      [
        'dsn',
        'environment',
        'release',
        'dist',
        'sendDefaultPii',
        'tracesSampleRate',
        'enableAutoPerformanceTracing',
        'enableUserInteractionTracing',
        'attachScreenshot',
        'attachViewHierarchy',
        'replaysSessionSampleRate',
        'replaysOnErrorSampleRate',
        'enableCaptureFailedRequests',
        'enableAppStartTracking',
        'enableNativeFramesTracking',
        'enableStallTracking',
        'tracePropagationTargets',
        'enableAutoSessionTracking',
        'enableLogs',
        'spotlight',
        'enableAutoBreadcrumbTracking',
        'enableNetworkBreadcrumbs',
        'maxBreadcrumbs',
        'beforeSend',
        'beforeBreadcrumb',
      ].sort(),
    );
  });

  it('passes the DSN trimmed', () => {
    expect(build({ dsn: `  ${EU_DSN} ` })?.dsn).toBe(EU_DSN);
  });

  it('names the environment after the update channel, development when there is none', () => {
    expect(build()?.environment).toBe('testflight');
    expect(build({ channel: 'production' })?.environment).toBe('production');
    expect(build({ channel: null })?.environment).toBe(DEFAULT_ENVIRONMENT);
    expect(build({ channel: undefined })?.environment).toBe('development');
    expect(build({ channel: '  ' })?.environment).toBe('development');
  });

  it('names the release com.automatos.app@<version>+<build>, with the build as dist', () => {
    expect(build()).toMatchObject({ release: 'com.automatos.app@1.0.0+12', dist: '12' });
  });

  it('leaves the build out of the release, and dist unset, when there is no build number', () => {
    const options = build({ buildNumber: null });
    expect(options?.release).toBe('com.automatos.app@1.0.0');
    expect(options).not.toHaveProperty('dist');
    expect(releaseName('1.2.0', ' ')).toBe('com.automatos.app@1.2.0');
  });

  it("uses app.json's bundle id as the release prefix", () => {
    const appJson = JSON.parse(readFileSync(path.join(ROOT, 'app.json'), 'utf8')) as {
      expo: { ios: { bundleIdentifier: string }; android: { package: string } };
    };
    expect(RELEASE_PREFIX).toBe(appJson.expo.ios.bundleIdentifier);
    expect(RELEASE_PREFIX).toBe(appJson.expo.android.package);
  });

  it('scrubs an event through beforeSend: no user leaves the phone (R02)', async () => {
    const event = {
      type: undefined,
      user: { id: 'u1', ip_address: '203.0.113.7' },
      level: 'error' as const,
    };
    const sent = await build()?.beforeSend?.(event, {});
    expect(sent).toEqual({ level: 'error' });
  });
});

describe("options.ts gives each 'off' its reason (KR7)", () => {
  const source = readFileSync(path.resolve(__dirname, '../options.ts'), 'utf8');
  const offLines = source.split('\n').filter((line) => /^\s+\w+: (false|0|\[\]),/.test(line));

  it('has the off lines', () => {
    expect(offLines).toHaveLength(18);
  });

  it.each(offLines.map((line) => [line.trim().split(':')[0], line] as const))(
    '%s says why on its line',
    (_name, line) => {
      expect(line).toMatch(/\/\/ off: \S.{8,}/);
    },
  );
});
