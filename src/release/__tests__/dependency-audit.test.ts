// R11 and KR10 as a test that keeps running in CI: the app has no analytics, advertising,
// attribution or tracking SDK and no WebView, in package.json or anywhere in the installed tree,
// @sentry/react-native is its only crash or error SDK, and app.json declares no tracking.

import { describe, expect, it } from 'vitest';

import {
  CRASH_SDK,
  CRASH_SDK_FAMILY,
  matchesPattern,
  OTHER_ERROR_SDKS,
  RELEASE_SDK_DENYLIST,
  type DenylistEntry,
} from './support/denylist';
import {
  declaredPackages,
  dependencyClosure,
  describeOffenders,
  lockKeyName,
  lockPackages,
  offenders,
  readLock,
  readPackageJson,
  type InstalledPackage,
  type Lock,
} from './support/packages';
import { readRepoFile } from './support/tree';

const pkg = readPackageJson();
const lock = readLock();
const declared = declaredPackages(pkg);
const installed = lockPackages(lock);

const SENTRY_FAMILY: readonly DenylistEntry[] = CRASH_SDK_FAMILY.map((pattern) => ({
  pattern,
  reason: 'a Sentry package',
}));

function sentryNames(packages: readonly InstalledPackage[]): string[] {
  return [...new Set(offenders(packages, SENTRY_FAMILY).map((found) => found.name))].sort();
}

describe('the matcher and the offender report', () => {
  it('matches a scope, a prefix and an exact name, nothing looser', () => {
    expect(matchesPattern('@react-native-firebase/analytics', '@react-native-firebase/*')).toBe(
      true,
    );
    expect(
      matchesPattern('@microsoft/applicationinsights-web', '@microsoft/applicationinsights-*'),
    ).toBe(true);
    expect(matchesPattern('react-native-webview', 'react-native-webview')).toBe(true);
    expect(matchesPattern('react-native-webview-bridge', 'react-native-webview')).toBe(false);
    expect(matchesPattern('firebase-tools', 'firebase')).toBe(false);
    expect(matchesPattern('posthog-jsx', 'posthog-js')).toBe(false);
  });

  it('names a nested or aliased offender with where it is and the reason', () => {
    const fake: Lock = {
      lockfileVersion: 3,
      packages: {
        '': {},
        'node_modules/zod': {},
        'node_modules/some-lib/node_modules/@segment/analytics-react-native': {},
        'node_modules/innocent': { name: 'react-native-webview' },
      },
    };
    expect(describeOffenders(offenders(lockPackages(fake), RELEASE_SDK_DENYLIST))).toEqual([
      '@segment/analytics-react-native (package-lock.json node_modules/some-lib/node_modules/' +
        '@segment/analytics-react-native): an analytics SDK: the labels say no analytics (R11)',
      'react-native-webview (package-lock.json node_modules/innocent): a WebView: none anywhere ' +
        '(D-NO-WEBVIEW)',
    ]);
  });

  it('reads an npm alias in package.json as the package it really is', () => {
    const aliased = declaredPackages({
      name: 'automatos-go',
      dependencies: { charts: 'npm:@amplitude/analytics-react-native@1.0.0' },
    });
    expect(offenders(aliased, RELEASE_SDK_DENYLIST).map((found) => found.name)).toEqual([
      '@amplitude/analytics-react-native',
    ]);
  });
});

describe('no analytics, advertising, tracking SDK or WebView (R11, KR10, D-NO-WEBVIEW)', () => {
  it('reads every declared dependency and every installed package, nested ones included', () => {
    expect(declared.length).toBeGreaterThan(40);
    expect(installed.length).toBeGreaterThan(declared.length);
    const nested = Object.keys(lock.packages).filter(
      (key) => key.split('node_modules/').length > 2,
    );
    expect(nested.length).toBeGreaterThan(0);
    expect(installed.map((item) => item.where)).toContain(`package-lock.json ${nested[0]}`);
  });

  it('package.json dependencies and devDependencies match no denylist entry', () => {
    expect(describeOffenders(offenders(declared, RELEASE_SDK_DENYLIST))).toEqual([]);
  });

  it('no package-lock.json entry matches a denylist entry', () => {
    expect(describeOffenders(offenders(installed, RELEASE_SDK_DENYLIST))).toEqual([]);
  });
});

describe('@sentry/react-native is the only crash or error SDK (KR7, KR10)', () => {
  it('no other crash or error SDK is declared or installed', () => {
    expect(describeOffenders(offenders(declared, OTHER_ERROR_SDKS))).toEqual([]);
    expect(describeOffenders(offenders(installed, OTHER_ERROR_SDKS))).toEqual([]);
  });

  it('package.json declares one Sentry package: the React Native SDK', () => {
    expect(sentryNames(declared)).toEqual([CRASH_SDK]);
  });

  it("every installed Sentry package is part of @sentry/react-native's own tree", () => {
    const tree = dependencyClosure(lock, CRASH_SDK);
    const installedSentry = sentryNames(installed);
    expect(installedSentry).toContain(CRASH_SDK);
    expect(installedSentry.filter((name) => !tree.has(name))).toEqual([]);
  });

  it('the closure follows nested and optional dependencies by name', () => {
    const fake: Lock = {
      lockfileVersion: 3,
      packages: {
        'node_modules/a': { dependencies: { b: '1' } },
        'node_modules/a/node_modules/b': { optionalDependencies: { c: '1' } },
        'node_modules/c': {},
        'node_modules/d': {},
      },
    };
    expect([...dependencyClosure(fake, 'a')].sort()).toEqual(['a', 'b', 'c']);
    expect(lockKeyName('node_modules/a/node_modules/@s/b')).toBe('@s/b');
    expect(lockKeyName('')).toBe('');
  });
});

type Manifest = Readonly<{ NSPrivacyTracking?: unknown; NSPrivacyTrackingDomains?: unknown }>;

/** What makes a privacy manifest declare tracking: tracking on, or any tracking domain. */
function trackingProblems(manifest: Manifest | undefined): string[] {
  if (manifest === undefined) return [];
  const domains = manifest.NSPrivacyTrackingDomains ?? [];
  return [
    ...(manifest.NSPrivacyTracking === false ? [] : ['NSPrivacyTracking is not false']),
    ...(Array.isArray(domains) && domains.length === 0 ? [] : ['NSPrivacyTrackingDomains listed']),
  ];
}

describe('app.json declares no tracking (KR10)', () => {
  const appJsonText = readRepoFile('app.json');
  const ios = (JSON.parse(appJsonText) as { expo: { ios: { privacyManifests?: Manifest } } }).expo
    .ios;

  it('carries no NSUserTrackingUsageDescription anywhere', () => {
    expect(appJsonText).not.toContain('NSUserTrackingUsageDescription');
  });

  it('a privacy manifest, when there is one, says NSPrivacyTracking false and no domains', () => {
    expect(trackingProblems(ios.privacyManifests)).toEqual([]);
  });

  it('the manifest check fires on tracking or a tracking domain', () => {
    expect(trackingProblems(undefined)).toEqual([]);
    expect(trackingProblems({ NSPrivacyTracking: false })).toEqual([]);
    expect(trackingProblems({})).toEqual(['NSPrivacyTracking is not false']);
    expect(
      trackingProblems({ NSPrivacyTracking: true, NSPrivacyTrackingDomains: ['ads.example'] }),
    ).toEqual(['NSPrivacyTracking is not false', 'NSPrivacyTrackingDomains listed']);
  });
});
