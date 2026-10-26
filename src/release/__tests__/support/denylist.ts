// The SDKs the store answers say the app does not have (R11, KR10): no analytics, advertising,
// attribution or tracking SDK, no App Tracking Transparency, no WebView (D-NO-WEBVIEW), and no
// crash or error SDK but @sentry/react-native. A pattern is an npm package name; '*' matches any
// run of characters, so '@segment/*' is every package in that scope.

export type DenylistEntry = Readonly<{ pattern: string; reason: string }>;

const ANALYTICS = 'an analytics SDK: the labels say no analytics (R11)';
const ADVERTISING = 'an advertising or attribution SDK: the labels say Tracking: No (KR10)';
const TRACKING = 'App Tracking Transparency: the app does not track (KR10)';
const ERROR_SDK = 'a second crash or error SDK: @sentry/react-native is the only one (KR7)';

export const RELEASE_SDK_DENYLIST: readonly DenylistEntry[] = [
  { pattern: '@react-native-firebase/*', reason: `Firebase: ${ANALYTICS}` },
  { pattern: 'firebase', reason: `Firebase: ${ANALYTICS}` },
  { pattern: 'expo-firebase-analytics', reason: ANALYTICS },
  { pattern: 'expo-firebase-core', reason: `Firebase: ${ANALYTICS}` },
  { pattern: '@segment/*', reason: ANALYTICS },
  { pattern: '@amplitude/*', reason: ANALYTICS },
  { pattern: 'mixpanel-react-native', reason: ANALYTICS },
  { pattern: 'posthog-react-native', reason: ANALYTICS },
  { pattern: 'posthog-js', reason: ANALYTICS },
  { pattern: '@datadog/*', reason: `${ANALYTICS}; ${ERROR_SDK}` },
  { pattern: '@bugsnag/*', reason: ERROR_SDK },
  { pattern: 'instabug-reactnative', reason: `${ANALYTICS}; ${ERROR_SDK}` },
  { pattern: '@newrelic/*', reason: `${ANALYTICS}; ${ERROR_SDK}` },
  { pattern: 'react-native-appsflyer', reason: ADVERTISING },
  { pattern: 'react-native-adjust', reason: ADVERTISING },
  { pattern: 'react-native-branch', reason: ADVERTISING },
  { pattern: 'react-native-fbsdk-next', reason: `Facebook SDK: ${ADVERTISING}` },
  { pattern: 'expo-facebook', reason: `Facebook SDK: ${ADVERTISING}` },
  { pattern: 'expo-tracking-transparency', reason: TRACKING },
  { pattern: 'react-native-tracking-transparency', reason: TRACKING },
  { pattern: 'react-native-google-mobile-ads', reason: ADVERTISING },
  { pattern: 'expo-ads-admob', reason: ADVERTISING },
  { pattern: '@microsoft/applicationinsights-*', reason: ANALYTICS },
  { pattern: 'react-native-webview', reason: 'a WebView: none anywhere (D-NO-WEBVIEW)' },
];

// The crash or error SDKs the denylist above does not already name: any of them beside Sentry
// would make '@sentry/react-native is the only crash or error SDK' false.
export const OTHER_ERROR_SDKS: readonly DenylistEntry[] = [
  { pattern: '@react-native-firebase/crashlytics', reason: ERROR_SDK },
  { pattern: 'rollbar', reason: ERROR_SDK },
  { pattern: 'rollbar-react-native', reason: ERROR_SDK },
  { pattern: '@rollbar/*', reason: ERROR_SDK },
  { pattern: 'raygun4reactnative', reason: ERROR_SDK },
  { pattern: 'raygun4js', reason: ERROR_SDK },
  { pattern: '@honeybadger-io/*', reason: ERROR_SDK },
  { pattern: 'logrocket', reason: ERROR_SDK },
  { pattern: '@logrocket/*', reason: ERROR_SDK },
  { pattern: '@embrace-io/*', reason: ERROR_SDK },
  { pattern: 'appcenter', reason: ERROR_SDK },
  { pattern: 'appcenter-*', reason: ERROR_SDK },
];

/** The one crash and error SDK (D-SENTRY); every @sentry/* package must come from its tree. */
export const CRASH_SDK = '@sentry/react-native';
export const CRASH_SDK_FAMILY = ['@sentry/*', '@sentry-internal/*'] as const;

/** True when an npm package name matches a denylist pattern ('*' is any run of characters). */
export function matchesPattern(name: string, pattern: string): boolean {
  const source = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\/]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}$`).test(name);
}

/** The first entry a package name matches, if any. */
export function deniedBy(
  name: string,
  entries: readonly DenylistEntry[],
): DenylistEntry | undefined {
  return entries.find((entry) => matchesPattern(name, entry.pattern));
}
