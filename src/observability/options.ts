// The one set of Sentry options the app starts with (D44, KR7, R01, R02): crash and error reports
// only, to Sentry's EU region, scrubbed before they leave the phone. Pure: the caller (US-021c's
// crash-reporting.ts) passes the DSN, the user's switch, the update channel and the build's
// version, and gets null whenever nothing may be sent. Every 'off' below says why on its line,
// because the App Store and Play labels depend on it: Crash Data collected and not linked to the
// user; Performance Data and Product Interaction not collected. The SDK hands every option but the
// callbacks to the native SDKs too (dist/js/wrapper.js initNativeSdk): a native crash never passes
// beforeSend, so what it may carry is set here (no native auto breadcrumbs, no sessions).

import type { ReactNativeOptions } from '@sentry/react-native';

import { scrubBreadcrumb, scrubEvent } from './scrub';

/** Sentry's EU ingest hosts are o<org>.ingest.de.sentry.io: a DSN for any other host is refused. */
export const EU_INGEST_HOST_SUFFIX = '.ingest.de.sentry.io';
/** The release name's prefix: the bundle id in app.json (ios.bundleIdentifier, android.package). */
export const RELEASE_PREFIX = 'com.automatos.app';
/** The environment of a build that has no update channel (a development build). */
export const DEFAULT_ENVIRONMENT = 'development';
export const MAX_BREADCRUMBS = 30;

// @sentry/core's own DSN grammar (utils/dsn.js DSN_REGEX), so the host checked here is the host
// the SDK sends to: protocol, public key, optional secret, host, optional port, path.
const DSN_PATTERN = /^(?:(\w+):)\/\/(?:(\w+)(?::(\w+)?)?@)([\w.-]+)(?::(\d+))?\/(.+)/;

/** True only for an https DSN whose host is a subdomain of Sentry's EU ingest host. */
export function isEuDsn(dsn: string): boolean {
  const match = DSN_PATTERN.exec(dsn);
  if (!match) return false;
  const [, protocol, , , host = ''] = match;
  return protocol === 'https' && host.toLowerCase().endsWith(EU_INGEST_HOST_SUFFIX);
}

export type SentryOptionsInput = {
  readonly dsn: string;
  /** The user's 'Send crash reports' switch (default on). */
  readonly enabled: boolean;
  /** The expo-updates channel (testflight, production, …); null or blank in a development build. */
  readonly channel?: string | null;
  readonly appVersion: string;
  readonly buildNumber?: string | null;
};

/**
 * sentry-cocoa options the React Native types do not list: RNSentry.mm passes the options
 * dictionary to SentryOptionsInternal initWithDict, which reads them by these names.
 */
export type NativeIosOptions = {
  readonly enableAutoBreadcrumbTracking?: boolean;
  readonly enableNetworkBreadcrumbs?: boolean;
};

export type SentryOptions = ReactNativeOptions &
  NativeIosOptions & {
    readonly dsn: string;
    readonly environment: string;
    readonly release: string;
  };

/** com.automatos.app@<version>+<build>; without a build number, com.automatos.app@<version>. */
export function releaseName(appVersion: string, buildNumber?: string | null): string {
  const build = buildNumber?.trim();
  return `${RELEASE_PREFIX}@${appVersion.trim()}${build ? `+${build}` : ''}`;
}

/** The options for Sentry.init, or null when the switch is off or the DSN is empty or not EU. */
export function buildSentryOptions(input: SentryOptionsInput): SentryOptions | null {
  const dsn = input.dsn.trim();
  if (!input.enabled || dsn === '' || !isEuDsn(dsn)) return null;
  const build = input.buildNumber?.trim();
  return {
    dsn,
    environment: input.channel?.trim() || DEFAULT_ENVIRONMENT,
    release: releaseName(input.appVersion, build),
    ...(build ? { dist: build } : {}),
    sendDefaultPii: false, // off: no IP address, cookies or user details are attached (R02)
    // 0 still counts as tracing to the SDK (integrations/default.js), so each tracer is off below
    tracesSampleRate: 0, // off: no performance tracing (no Performance Data on the labels)
    enableAutoPerformanceTracing: false, // off: no navigation or app-registry spans
    enableAppStartTracking: false, // off: no app-start span (Performance Data)
    enableNativeFramesTracking: false, // off: no frame-rate measurements (Performance Data)
    enableStallTracking: false, // off: no JS-stall measurements (Performance Data)
    enableUserInteractionTracing: false, // off: taps are never recorded (no Product Interaction)
    tracePropagationTargets: [], // off: no sentry-trace or baggage header on any request
    // profilesSampleRate stays unset: any number, 0 included, installs the Hermes profiler
    enableAutoSessionTracking: false, // off: a session records every app launch (Product Interaction)
    attachScreenshot: false, // off: a screenshot would show the chat on screen
    attachViewHierarchy: false, // off: the view tree carries the text of every label on screen
    replaysSessionSampleRate: 0, // off: no session replay (rate 0: the native recorder never starts)
    replaysOnErrorSampleRate: 0, // off: no replay of the moments before an error either
    enableCaptureFailedRequests: false, // off: a failed request's event would carry its URL and headers
    enableLogs: false, // off: no log lines are sent
    spotlight: false, // off: no local debug sidecar receives events
    enableAutoBreadcrumbTracking: false, // off: iOS screen titles, taps and device events never reach a native crash
    enableNetworkBreadcrumbs: false, // off: iOS request URLs (a self-hosted host, a chat id) never reach a native crash
    maxBreadcrumbs: MAX_BREADCRUMBS,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
