// Crash reporting's life in the app (R01–R03, D44, KR7): start once at launch when the user's switch
// is on and the build carries an EU DSN, stop when the switch goes off, start again when it comes
// back on, and send one test report on request so the owner can see a real event scrubbed in
// Sentry (OT-R1). Pure over injected ports: index.ts binds @sentry/react-native, the switch's MMKV
// file, the build env and the app's version; the tests use fakes. Only three SDK calls exist here:
// init, close and captureMessage. Never setUser (no user on any event, R02), never wrap (its touch
// boundary records taps) and no integration is added (no navigation or touch tracking).

import type { SeverityLevel } from '@sentry/react-native';

import { logger } from '../lib/logger';
import type { KeyValueStorage } from '../storage/encrypted-storage';
import { createCrashSetting } from './crash-setting';
import { buildSentryOptions, type SentryOptions } from './options';

export const TEST_REPORT_MESSAGE = 'Automatos Go test report';
/** The version a release is named with when the build has none (never in a store build). */
export const UNKNOWN_APP_VERSION = 'unknown';

/**
 * Fake values in fields the scrubber must remove (extra keeps none of them), so the owner can see
 * on a real event in Sentry that they never arrive. None is a real question, chat or call.
 */
export const TEST_REPORT_PROBES = Object.freeze({
  question_text: 'PROBE question text: must not reach Sentry',
  chat_text: 'PROBE chat text: must not reach Sentry',
  call_id: 'call_PROBE0000000000000000',
});

export type TestReportContext = {
  readonly level: SeverityLevel;
  readonly extra: Readonly<Record<string, string>>;
};

/** The SDK calls the app makes, and nothing else of the SDK. */
export type SentryPort = {
  readonly init: (options: SentryOptions) => void;
  readonly close: () => Promise<void>;
  readonly captureMessage: (message: string, context: TestReportContext) => string;
};

export type CrashReportingEnv = {
  /** EXPO_PUBLIC_SENTRY_DSN as src/lib/env.ts parsed it ('' when not configured). */
  readonly sentryDsn: string;
};

/** The build's facts, as the native modules report them (null when a module has none). */
export type AppFacts = {
  /** expo-updates' channel; null in a development build. */
  readonly channel: string | null;
  readonly appVersion: string | null;
  readonly buildNumber: string | null;
};

export type CrashReportingDeps = {
  readonly sentry: SentryPort;
  /** Opens the switch's store; called once, on the first read. */
  readonly storage: () => KeyValueStorage;
  readonly env: CrashReportingEnv;
  readonly app: AppFacts;
};

export type CrashReporting = {
  /** Starts Sentry if it may run; a second call while it runs does nothing. */
  readonly init: () => void;
  /** The user's switch. */
  readonly isEnabled: () => boolean;
  /** Saves the choice, then stops or starts Sentry; calls run in order. */
  readonly setEnabled: (on: boolean) => Promise<void>;
  /** Captures the test report; false (nothing sent) while reporting is off or not running. */
  readonly sendTestReport: () => boolean;
};

export function createCrashReporting(deps: CrashReportingDeps): CrashReporting {
  const setting = createCrashSetting(deps.storage);
  let running = false;
  let queue: Promise<void> = Promise.resolve();

  const init = (): void => {
    if (running) return;
    const options = optionsFor(deps, setting.crashReportsEnabled());
    running = options !== null && startSentry(deps.sentry, options);
  };

  const stop = async (): Promise<void> => {
    if (!running) return;
    running = false;
    await closeSentry(deps.sentry);
  };

  const setEnabled = (on: boolean): Promise<void> => {
    setting.setCrashReportsEnabled(on);
    queue = queue.then(() => (on ? init() : stop()));
    return queue;
  };

  const sendTestReport = (): boolean =>
    running && setting.crashReportsEnabled() && captureTestReport(deps.sentry);

  return Object.freeze({
    init,
    isEnabled: setting.crashReportsEnabled,
    setEnabled,
    sendTestReport,
  });
}

function optionsFor(deps: CrashReportingDeps, enabled: boolean): SentryOptions | null {
  return buildSentryOptions({
    dsn: deps.env.sentryDsn,
    enabled,
    channel: deps.app.channel,
    appVersion: deps.app.appVersion?.trim() || UNKNOWN_APP_VERSION,
    buildNumber: deps.app.buildNumber,
  });
}

/** true once the SDK started; a throw (a missing native module) leaves reporting off. */
function startSentry(sentry: SentryPort, options: SentryOptions): boolean {
  try {
    sentry.init(options);
    return true;
  } catch (error) {
    logger.warn('[crash-reports] Sentry did not start', error);
    return false;
  }
}

async function closeSentry(sentry: SentryPort): Promise<void> {
  try {
    await sentry.close();
  } catch (error) {
    logger.warn('[crash-reports] Sentry did not close cleanly', error);
  }
}

function captureTestReport(sentry: SentryPort): boolean {
  try {
    sentry.captureMessage(TEST_REPORT_MESSAGE, { level: 'info', extra: { ...TEST_REPORT_PROBES } });
    return true;
  } catch (error) {
    logger.warn('[crash-reports] the test report was not captured', error);
    return false;
  }
}
