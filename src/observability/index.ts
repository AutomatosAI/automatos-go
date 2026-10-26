// Crash reporting, wired to the native modules (KR7): the app's ONLY importer of
// @sentry/react-native. It binds the SDK's init, close and captureMessage, the switch's own plain
// MMKV file, the build's EXPO_PUBLIC_SENTRY_DSN (src/lib/env.ts), the expo-updates channel and the
// version and build number the binary carries (expo-constants: app.json's version, as Settings
// shows it, and the iOS CFBundleVersion; Android reports no build number). The logic and its tests
// live in crash-reporting.ts; app/_layout.tsx calls initCrashReporting() once at module load.

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { createMMKV } from 'react-native-mmkv';

import { env } from '../lib/env';
import { mmkvStorage } from '../storage/encrypted-storage';
import { createCrashReporting, type CrashReporting } from './crash-reporting';
import { CRASH_SETTING_STORE_ID } from './crash-setting';

const reporting: CrashReporting = createCrashReporting({
  sentry: {
    init: (options) => Sentry.init(options),
    close: () => Sentry.close(),
    captureMessage: (message, context) => Sentry.captureMessage(message, context),
  },
  storage: () => mmkvStorage(createMMKV({ id: CRASH_SETTING_STORE_ID })),
  env,
  app: {
    channel: Updates.channel,
    appVersion: Constants.expoConfig?.version ?? null,
    buildNumber: Constants.platform?.ios?.buildNumber ?? null,
  },
});

/** Starts Sentry when the switch is on and the build has an EU DSN; once per launch. */
export const initCrashReporting: () => void = reporting.init;
/** The 'Send crash reports' switch (default on). */
export const crashReportsEnabled: () => boolean = reporting.isEnabled;
/** Saves the switch; off closes Sentry, on starts it. */
export const setCrashReportsEnabled: (on: boolean) => Promise<void> = reporting.setEnabled;
/** Sends 'Automatos Go test report' with its planted probe fields; false while reports are off. */
export const sendTestReport: () => boolean = reporting.sendTestReport;
