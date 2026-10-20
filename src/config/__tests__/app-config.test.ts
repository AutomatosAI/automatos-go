// app.json is the native identity of the build: a wrong value here costs an iOS
// build (fingerprint policy) or a store rejection, so every value is pinned.

import { describe, expect, it } from 'vitest';

import appJson from '../../../app.json';

const { expo } = appJson;

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
