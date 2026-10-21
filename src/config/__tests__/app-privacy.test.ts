// The store's privacy rules for app.json (split from app-config.test.ts): every privacy
// framework the binary references has its usage string, the privacy manifest declares what
// the SDKs collect and why, and Android asks for nothing it does not use.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { IOSConfig } from 'expo/config-plugins';
import { describe, expect, it } from 'vitest';

import {
  expo,
  infoPlist,
  privacy,
  PROJECT_ROOT,
  pluginOptions,
  type PluginEntry,
  type PrivacyManifest,
} from './app-json';
import {
  ANDROID_BLOCKED,
  ANDROID_PERMISSIONS,
  REFERENCED_ONLY_KEYS,
  REQUIRED_KEYS,
  UNREFERENCED_KEYS,
  USED_KEYS,
} from './store-rules';

const UNUSED_NOTICE =
  'a bundled library references it, so Apple requires this notice; the app never asks for access.';
describe('iOS usage strings (US-002c, ITMS-90683)', () => {
  it.each(REQUIRED_KEYS)('%s is 30+ characters and names Automatos Go', (key) => {
    const value = infoPlist[key];
    expect(typeof value).toBe('string');
    expect(String(value).length).toBeGreaterThanOrEqual(30);
    expect(value).toContain('Automatos Go');
  });

  it.each(REFERENCED_ONLY_KEYS)('%s says the app does not use it and never asks', (key) => {
    expect(infoPlist[key]).toMatch(/^Automatos Go does not /);
    expect(infoPlist[key]).toContain(UNUSED_NOTICE);
  });

  it.each(USED_KEYS)('%s says what the app uses it for', (key) => {
    expect(infoPlist[key]).not.toContain(UNUSED_NOTICE);
  });

  it.each(UNREFERENCED_KEYS)('%s is absent: no bundled module references it', (key) => {
    expect(infoPlist).not.toHaveProperty(key);
  });
});

describe('App Transport Security (K11)', () => {
  it('allows plain HTTP to local networks only', () => {
    expect(expo.ios.infoPlist.NSAppTransportSecurity).toEqual({ NSAllowsLocalNetworking: true });
  });

  it('never allows arbitrary loads', () => {
    expect(expo.ios.infoPlist.NSAppTransportSecurity).not.toHaveProperty('NSAllowsArbitraryLoads');
  });
});

// ITMS-91053: the privacy manifest. The collected types follow the privacy policy draft's
const dataType = (name: string) => `NSPrivacyCollectedDataType${name}`;
const LINKED_TYPES = [
  'EmailAddress',
  'Name',
  'PhotosorVideos',
  'AudioData',
  'CustomerSupport',
  'OtherUserContent',
  'UserID',
  'DeviceID',
  'OtherUsageData',
  'OtherDiagnosticData',
].map(dataType);
const NOT_LINKED_TYPES = ['CrashData'].map(dataType);
// No analytics, no performance tracing, no location: the app collects none (US-002f notes).
const NEVER_DECLARED = [
  'ProductInteraction',
  'PerformanceData',
  'PreciseLocation',
  'CoarseLocation',
].map(dataType);

const collectedTypes = (linked: boolean) =>
  privacy.NSPrivacyCollectedDataTypes.filter(
    (entry) => entry.NSPrivacyCollectedDataTypeLinked === linked,
  ).map((entry) => entry.NSPrivacyCollectedDataType);

// Each accessed-API reason as 'category reason', so manifests compare as sets.
const declaredReasons = (manifest: Partial<PrivacyManifest>) =>
  (manifest.NSPrivacyAccessedAPITypes ?? [])
    .flatMap((entry) =>
      entry.NSPrivacyAccessedAPITypeReasons.map(
        (reason) => `${entry.NSPrivacyAccessedAPIType} ${reason}`,
      ),
    )
    .sort();

const XCPRIVACY_API_KEY = '<key>NSPrivacyAccessedAPIType</key>';
const XCPRIVACY_API_ENTRY =
  /<key>NSPrivacyAccessedAPIType<\/key>\s*<string>([^<]+)<\/string>\s*<key>NSPrivacyAccessedAPITypeReasons<\/key>\s*<array>([\s\S]*?)<\/array>/g;

// The accessed-API entries of one PrivacyInfo.xcprivacy (an XML plist), as 'category reason'.
function xcprivacyReasons(xml: string): { entries: number; reasons: string[] } {
  const matches = [...xml.matchAll(XCPRIVACY_API_ENTRY)];
  const reasons = matches.flatMap(([, category, array]) =>
    [...array.matchAll(/<string>([^<]+)<\/string>/g)].map(([, reason]) => `${category} ${reason}`),
  );
  return { entries: matches.length, reasons };
}

// Every PrivacyInfo.xcprivacy under node_modules (the files docs/native-modules.md lists), with
// how many accessed-API keys it has and the reasons the parser read.
function nodeModulesManifests() {
  const out = execFileSync('find', ['node_modules', '-name', 'PrivacyInfo.xcprivacy'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter(Boolean)
    .sort()
    .map((file) => {
      const xml = readFileSync(path.join(PROJECT_ROOT, file), 'utf8');
      return { file, keys: xml.split(XCPRIVACY_API_KEY).length - 1, ...xcprivacyReasons(xml) };
    });
}

describe('iOS privacy manifest (US-002f, ITMS-91053)', () => {
  // read once at collection, like introspect() below, so the scan is not under a test timeout
  const manifests = nodeModulesManifests();

  it('declares no tracking and no tracking domains', () => {
    expect(privacy.NSPrivacyTracking).toBe(false);
    expect(privacy.NSPrivacyTrackingDomains).toEqual([]);
  });

  it('declares exactly the linked and the not-linked collected types, each once', () => {
    expect([...collectedTypes(true)].sort()).toEqual([...LINKED_TYPES].sort());
    expect(collectedTypes(false)).toEqual(NOT_LINKED_TYPES);
    expect(privacy.NSPrivacyCollectedDataTypes).toHaveLength(
      LINKED_TYPES.length + NOT_LINKED_TYPES.length,
    );
  });

  it('collects every type for App Functionality only, never for tracking', () => {
    for (const entry of privacy.NSPrivacyCollectedDataTypes) {
      expect(entry.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(entry.NSPrivacyCollectedDataTypePurposes).toEqual([
        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
      ]);
    }
  });

  it.each(NEVER_DECLARED)('does not declare %s', (type) => {
    expect([...collectedTypes(true), ...collectedTypes(false)]).not.toContain(type);
  });

  it('declares no location type of any kind', () => {
    const types = privacy.NSPrivacyCollectedDataTypes.map(
      (entry) => entry.NSPrivacyCollectedDataType,
    );
    expect(types.filter((name) => name.includes('Location'))).toEqual([]);
  });

  it('gives every accessed-API entry at least one reason, one entry per category', () => {
    const categories = privacy.NSPrivacyAccessedAPITypes.map(
      (entry) => entry.NSPrivacyAccessedAPIType,
    );
    expect(new Set(categories).size).toBe(categories.length);
    for (const entry of privacy.NSPrivacyAccessedAPITypes) {
      expect(entry.NSPrivacyAccessedAPITypeReasons.length).toBeGreaterThan(0);
    }
  });

  it('reads every accessed-API entry of each node_modules PrivacyInfo.xcprivacy', () => {
    expect(manifests.length).toBeGreaterThan(0);
    for (const { file, keys, entries } of manifests) {
      expect({ file, entries }).toEqual({ file, entries: keys });
    }
  });

  it('declares the union of every PrivacyInfo.xcprivacy under node_modules', () => {
    const union = [...new Set(manifests.flatMap((manifest) => manifest.reasons))].sort();
    expect(declaredReasons(privacy)).toEqual(union);
  });

  it("survives Expo's build-time merge into PrivacyInfo.xcprivacy, also on a re-run", () => {
    const { mergePrivacyInfo } = IOSConfig.PrivacyInfo;
    const first = mergePrivacyInfo({}, privacy);
    expect(first).toEqual(privacy);
    expect(mergePrivacyInfo(first, privacy)).toEqual(privacy);
  });
});

describe('Android permissions (US-002c)', () => {
  it('declares exactly what the modules need', () => {
    expect(expo.android.permissions).toEqual(ANDROID_PERMISSIONS);
  });

  it('blocks what modules or the template add and the app does not use', () => {
    expect(expo.android.blockedPermissions).toEqual(ANDROID_BLOCKED);
  });

  it('never both declares and blocks a permission', () => {
    const declared = new Set<string>(expo.android.permissions);
    expect(expo.android.blockedPermissions.filter((name) => declared.has(name))).toEqual([]);
  });

  it('allows cleartext for private-address servers through expo-build-properties (K11)', () => {
    expect(
      pluginOptions(expo.plugins as readonly PluginEntry[], 'expo-build-properties'),
    ).toMatchObject({
      android: { usesCleartextTraffic: true },
    });
  });

  it('turns Android auto backup off (US-002f): no app data in a cloud backup', () => {
    expect(expo.android.allowBackup).toBe(false);
  });
});
