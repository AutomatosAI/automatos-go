// app.json is the native identity of the build: a wrong value here costs an iOS
// build (fingerprint policy) or a store rejection, so every value is pinned.

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import appJson from '../../../app.json';

const { expo } = appJson;

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const requireFromRoot = createRequire(path.join(PROJECT_ROOT, 'package.json'));

type PluginEntry = string | [string, Record<string, unknown>];

function pluginNames(plugins: readonly PluginEntry[]): string[] {
  return plugins.map((entry) => (typeof entry === 'string' ? entry : entry[0]));
}

function pluginOptions(plugins: readonly PluginEntry[], name: string): unknown {
  const entry = plugins.find((item) => Array.isArray(item) && item[0] === name);
  return Array.isArray(entry) ? entry[1] : undefined;
}

describe('app.json identity (D-IDENTITY)', () => {
  it('names the app Automatos Go with its slug, scheme and version', () => {
    expect(expo.name).toBe('Automatos Go');
    expect(expo.slug).toBe('automatos-go');
    expect(expo.scheme).toBe('automatos');
    expect(expo.version).toBe('1.0.0');
  });

  it('is portrait, follows the system appearance and runs the new architecture', () => {
    expect(expo.orientation).toBe('portrait');
    expect(expo.userInterfaceStyle).toBe('automatic');
    expect(expo.newArchEnabled).toBe(true);
  });

  it('is an iPhone-only iOS app with bundle id com.automatos.app', () => {
    expect(expo.ios.supportsTablet).toBe(false);
    expect(expo.ios.bundleIdentifier).toBe('com.automatos.app');
  });

  it('declares no non-exempt encryption (no export-compliance prompt)', () => {
    expect(expo.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
  });

  it('uses package com.automatos.app on Android', () => {
    expect(expo.android.package).toBe('com.automatos.app');
  });

  it('versions the runtime by fingerprint, not app version (D46)', () => {
    expect(expo.runtimeVersion).toEqual({ policy: 'fingerprint' });
  });
});

describe('app.json plugins', () => {
  const plugins = expo.plugins as readonly PluginEntry[];

  it('wires expo-router, expo-secure-store and expo-build-properties', () => {
    expect(pluginNames(plugins)).toEqual(
      expect.arrayContaining(['expo-router', 'expo-secure-store', 'expo-build-properties']),
    );
  });

  it('keeps the Clerk extraPods with modular headers', () => {
    expect(pluginOptions(plugins, 'expo-build-properties')).toMatchObject({
      ios: {
        extraPods: expect.arrayContaining([
          { name: 'GoogleUtilities', modular_headers: true },
          { name: 'RecaptchaInterop', modular_headers: true },
        ]),
      },
    });
  });

  // @clerk/expo >= 3.2 autolinks a ClerkExpo pod that needs iOS 17.0 and pulls
  // clerk-android with a duplicate META-INF entry. Clerk's own config plugin
  // would set both but also adds Sign in with Apple (D-SIGNIN), so
  // expo-build-properties carries them instead.
  it('raises iOS to 17.0 for the ClerkExpo pod', () => {
    expect(pluginOptions(plugins, 'expo-build-properties')).toMatchObject({
      ios: { deploymentTarget: '17.0' },
    });
  });

  it("excludes clerk-android's duplicate META-INF manifest from the APK", () => {
    expect(pluginOptions(plugins, 'expo-build-properties')).toMatchObject({
      android: { packagingOptions: { exclude: ['META-INF/versions/9/OSGI-INF/MANIFEST.MF'] } },
    });
  });

  it('does not wire the @clerk/expo plugin (it adds Sign in with Apple by default)', () => {
    expect(pluginNames(plugins)).not.toContain('@clerk/expo');
  });
});

// Expo resolves a plugin name to '<name>/app.plugin.js' first, then to the package entry;
// a './' name is a plugin file in this repository.
function resolvePlugin(name: string): string {
  if (name.startsWith('./')) return requireFromRoot.resolve(path.join(PROJECT_ROOT, name));
  try {
    return requireFromRoot.resolve(`${name}/app.plugin.js`);
  } catch {
    return requireFromRoot.resolve(name);
  }
}

describe('app.json plugins: every native module wired in the first build (US-002b, D-NATIVE-ONCE)', () => {
  const plugins = expo.plugins as readonly PluginEntry[];
  const options = (name: string) => pluginOptions(plugins, name);

  it.each(pluginNames(plugins))('%s resolves from node_modules or the repo', (name) => {
    expect(resolvePlugin(name)).toMatch(/\.(c?js)$/);
  });

  it('lists each plugin once', () => {
    const names = pluginNames(plugins);
    expect(new Set(names).size).toBe(names.length);
  });

  it('wires every module that ships a config plugin', () => {
    expect(pluginNames(plugins)).toEqual(
      expect.arrayContaining([
        'expo-notifications',
        'expo-local-authentication',
        'expo-camera',
        'expo-image-picker',
        'expo-document-picker',
        'expo-speech-recognition',
        '@livekit/react-native-expo-plugin',
        '@config-plugins/react-native-webrtc',
        'expo-video',
        '@sentry/react-native',
        'expo-localization',
        'expo-system-ui',
        'expo-build-properties',
        './plugins/with-pinned-background-modes',
        './plugins/with-sentry-upload-guard',
      ]),
    );
  });

  it('never wires Sign in with Apple or a WebView (D-SIGNIN, D-NO-WEBVIEW)', () => {
    expect(pluginNames(plugins)).not.toContain('expo-apple-authentication');
    expect(pluginNames(plugins)).not.toContain('react-native-webview');
  });

  it('registers for background remote notifications (K11)', () => {
    expect(options('expo-notifications')).toEqual({ enableBackgroundRemoteNotifications: true });
  });

  it('keeps barcode scanning on in expo-camera (the pairing QR code)', () => {
    expect(options('expo-camera')).toEqual({ barcodeScannerEnabled: true });
  });

  it("lets Android find the Google app's speech service, as the academy template does", () => {
    expect(options('expo-speech-recognition')).toEqual({
      androidSpeechServicePackages: ['com.google.android.googlequicksearchbox'],
    });
  });

  it('runs LiveKit audio as a call on Android', () => {
    expect(options('@livekit/react-native-expo-plugin')).toEqual({
      android: { audioType: 'communication' },
    });
  });

  it('gives expo-video no background playback and no picture in picture (D33: no audio mode)', () => {
    expect(options('expo-video')).toEqual({
      supportsBackgroundPlayback: false,
      supportsPictureInPicture: false,
    });
  });

  it('points Sentry at the EU region and keeps every token out of the repo (D44, D-NO-SECRETS)', () => {
    expect(options('@sentry/react-native')).toEqual({ url: 'https://de.sentry.io/' });
  });

  it('leaves Android minSdkVersion at the React Native default: no module needs more', () => {
    expect(options('expo-build-properties')).not.toHaveProperty('android.minSdkVersion');
  });
});

describe('app.json links and background modes (K9, K11)', () => {
  it('claims ui.automatos.app universal links and Clerk passkey credentials, nothing else', () => {
    expect(expo.ios.associatedDomains).toEqual([
      'applinks:ui.automatos.app',
      'webcredentials:clerk.automatos.app',
    ]);
  });

  it('verifies Android app links for /go, /command-center and /chat on ui.automatos.app', () => {
    expect(expo.android.intentFilters).toEqual([
      {
        action: 'VIEW',
        autoVerify: true,
        data: ['/go', '/command-center', '/chat'].map((pathPrefix) => ({
          scheme: 'https',
          host: 'ui.automatos.app',
          pathPrefix,
        })),
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ]);
  });

  it('declares remote-notification as the only background mode (no audio, D33)', () => {
    expect(expo.ios.infoPlist.UIBackgroundModes).toEqual(['remote-notification']);
  });
});

type ManifestFilter = {
  $?: Record<string, string>;
  data?: { $: Record<string, string> }[];
};

type Introspected = {
  _internal: {
    modResults: {
      ios: { infoPlist: Record<string, unknown>; entitlements: Record<string, unknown> };
      android: {
        manifest: {
          manifest: { application: { activity: { 'intent-filter': ManifestFilter[] }[] }[] };
        };
      };
    };
  };
};

// `expo config --type introspect` evaluates every plugin's mods without writing ios/ or
// android/: these are the values prebuild would write into the native project.
function introspect(): Introspected {
  const cli = requireFromRoot.resolve('expo/bin/cli');
  const json = execFileSync(process.execPath, [cli, 'config', '--type', 'introspect', '--json'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(json) as Introspected;
}

describe('the evaluated native config (expo config --type introspect)', () => {
  const { ios, android } = introspect()._internal.modResults;

  it('Info.plist ends with exactly one background mode, remote-notification', () => {
    expect(ios.infoPlist.UIBackgroundModes).toEqual(['remote-notification']);
  });

  it('the entitlements carry exactly the two associated domains', () => {
    expect(ios.entitlements['com.apple.developer.associated-domains']).toEqual([
      'applinks:ui.automatos.app',
      'webcredentials:clerk.automatos.app',
    ]);
  });

  it('the Android manifest has one auto-verified https filter for the three paths', () => {
    const filters = android.manifest.manifest.application[0].activity[0]['intent-filter'];
    const verified = filters.filter((filter) => filter.$?.['android:autoVerify'] === 'true');
    expect(verified).toHaveLength(1);
    expect(verified[0].data?.map((entry) => entry.$['android:pathPrefix'])).toEqual([
      '/go',
      '/command-center',
      '/chat',
    ]);
  });
});

describe('app.json carries no EAS project link (OT-1, D-NO-SECRETS)', () => {
  it('has no owner', () => {
    expect(expo).not.toHaveProperty('owner');
  });

  it('has no extra.eas.projectId', () => {
    expect(expo.extra).not.toHaveProperty('eas');
  });

  it('has no updates.url', () => {
    expect(expo).not.toHaveProperty('updates');
  });
});
