// R06 as a test that keeps running in CI: app.json's ios.privacyManifests is what prebuild's
// withPrivacyInfo writes into the app's PrivacyInfo.xcprivacy. It declares no tracking; its
// collected types are exactly the labels JSON's collected Apple rows; its accessed-API reasons cover
// every reason declared by the PrivacyInfo.xcprivacy of any package package-lock.json installs, read
// with a plist reader; and Android Auto Backup is off, so the cache and the install marker never
// reach a cloud backup (critic-security-privacy). Remote CocoaPods (sentry-cocoa, LiveKit's
// WebRTC, Clerk's pods) are not in node_modules, so this test cannot read them: Apple's processing
// of the next native build is their check (OT-R4).

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { expo, privacy } from '../../config/__tests__/app-json';
import { readLock, type Lock } from './support/packages';
import { parsePlist, type PlistValue } from './support/plist';
import {
  APP_FUNCTIONALITY,
  KR15_ACCESSED_API_CATEGORIES,
  KR15_MANIFEST_KEYS,
  manifestPurpose,
  readPrivacyLabels,
} from './support/privacy-labels';
import { readRepoFile, repoRoot } from './support/tree';

const MANIFEST_FILE = 'PrivacyInfo.xcprivacy';
const NODE_MODULES = 'node_modules';
const REACT_NATIVE_MANIFEST = 'node_modules/react-native/React/Resources/PrivacyInfo.xcprivacy';
const REASON_CODE = /^[0-9A-F]{4}\.\d$/;

// A dependency's manifest as Apple defines it; unknown fields ignored, every field optional.
const xcprivacySchema = z.object({
  NSPrivacyTracking: z.boolean().optional(),
  NSPrivacyTrackingDomains: z.array(z.string()).optional(),
  NSPrivacyCollectedDataTypes: z
    .array(z.object({ NSPrivacyCollectedDataType: z.string().min(1) }))
    .optional(),
  NSPrivacyAccessedAPITypes: z
    .array(
      z.object({
        NSPrivacyAccessedAPIType: z.string().min(1),
        NSPrivacyAccessedAPITypeReasons: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
});

type Xcprivacy = z.infer<typeof xcprivacySchema>;
type DependencyManifest = Readonly<{ file: string; manifest: Xcprivacy }>;
type Collected = Readonly<{ NSPrivacyCollectedDataType: string }>;

/** Every PrivacyInfo.xcprivacy in one installed package (a nested node_modules is its own key). */
function manifestsIn(root: string, relDir: string): string[] {
  return readdirSync(path.join(root, relDir), { withFileTypes: true }).flatMap((entry) => {
    const child = path.posix.join(relDir, entry.name);
    if (entry.isDirectory()) return entry.name === NODE_MODULES ? [] : manifestsIn(root, child);
    return entry.isFile() && entry.name === MANIFEST_FILE ? [child] : [];
  });
}

/** The lock's packages: the ones on disk, and the required ones that are not (a partial install). */
function lockInstall(lock: Lock, root: string) {
  const keys = Object.keys(lock.packages).filter((key) => key.includes(`${NODE_MODULES}/`));
  const onDisk = keys.filter((key) => existsSync(path.join(root, key)));
  const present = new Set(onDisk);
  const missing = keys.filter((key) => !present.has(key) && lock.packages[key]?.optional !== true);
  return { onDisk, missing };
}

function readManifest(file: string): DependencyManifest {
  return { file, manifest: xcprivacySchema.parse(parsePlist(readRepoFile(file))) };
}

/** Each accessed-API reason as 'category reason', so manifests compare as sets. */
function reasonsOf(manifest: Xcprivacy): string[] {
  return (manifest.NSPrivacyAccessedAPITypes ?? []).flatMap((entry) =>
    entry.NSPrivacyAccessedAPITypeReasons.map(
      (reason) => `${entry.NSPrivacyAccessedAPIType} ${reason}`,
    ),
  );
}

/** How many <key> elements a parsed plist read, so a reader that drops one is caught. */
function keyCount(value: PlistValue): number {
  if (typeof value !== 'object') return 0;
  const items = Object.values(value);
  const own = Array.isArray(value) ? 0 : items.length;
  return items.reduce<number>((sum, item) => sum + keyCount(item), own);
}

const byType = (a: Collected, b: Collected) =>
  a.NSPrivacyCollectedDataType.localeCompare(b.NSPrivacyCollectedDataType);

// read once at collection, so the walk over node_modules is not under a test timeout
const root = repoRoot();
const install = lockInstall(readLock(), root);
const manifestFiles = install.onDisk.flatMap((key) => manifestsIn(root, key)).sort();
const labels = readPrivacyLabels();

describe('the plist reader (support/plist.ts)', () => {
  it("reads react-native's PrivacyInfo.xcprivacy, every key in it", () => {
    const xml = readRepoFile(REACT_NATIVE_MANIFEST);
    const value = parsePlist(xml);
    expect(value).toMatchObject({
      NSPrivacyTracking: false,
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: expect.arrayContaining([
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
      ]),
    });
    expect(keyCount(value)).toBe(xml.split('<key>').length - 1);
  });

  it('reads dict, array, string, true, false and integer, empty and self-closed forms too', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <!-- a comment -->
      <plist version="1.0"><dict>
        <key>text</key><string>a &lt;b&gt; &amp; &quot;c&quot; &#65;&#x42;</string>
        <key>blank</key><string/>
        <key>none</key><string></string>
        <key>count</key><integer> -42 </integer>
        <key>yes</key><true/>
        <key>no</key><false></false>
        <key>list</key><array><string>x</string><array/><dict/></array>
        <key>empty</key><array>
        </array>
      </dict></plist>`;
    expect(parsePlist(xml)).toEqual({
      text: 'a <b> & "c" AB',
      blank: '',
      none: '',
      count: -42,
      yes: true,
      no: false,
      list: ['x', [], {}],
      empty: [],
    });
  });

  it.each([
    ['a <real>', '<plist><real>1.5</real></plist>', '<real> is not an element'],
    ['a <data>', '<plist><data>AA==</data></plist>', '<data> is not an element'],
    ['a <date>', '<plist><date>2026-10-26T00:00:00Z</date></plist>', '<date> is not an element'],
    ['an element named like an object key', '<plist><constructor/></plist>', 'is not an element'],
    ['no <plist>', '<dict/>', 'expected <plist>'],
    ['an unclosed <plist>', '<plist><dict/>', 'expected </plist>'],
    ['an unclosed <array>', '<plist><array><string>x</string></plist>', 'expected a value'],
    ['text in a <dict>', '<plist><dict>loose</dict></plist>', 'expected <key>'],
    ['a key with no value', '<plist><dict><key>k</key></dict></plist>', 'expected a value'],
    [
      'a duplicate key',
      '<plist><dict><key>k</key><true/><key>k</key><false/></dict></plist>',
      'twice',
    ],
    ['a fraction in <integer>', '<plist><integer>1.5</integer></plist>', 'is not an <integer>'],
    ['an unknown entity', '<plist><string>&nbsp;</string></plist>', 'unknown entity'],
    ['a stray <', '<plist><string>a</string> < </plist>', "a '<' that starts no element"],
    ['content after </plist>', '<plist><true/></plist><plist/>', 'after </plist>'],
  ])('refuses %s', (_name, xml, message) => {
    expect(() => parsePlist(xml)).toThrow(message);
  });
});

describe('the iOS privacy manifest (R06, US-021f)', () => {
  it('declares no tracking and no tracking domains (KR10)', () => {
    expect(privacy.NSPrivacyTracking).toBe(false);
    expect(privacy.NSPrivacyTrackingDomains).toEqual([]);
  });

  it("collects exactly the labels JSON's collected Apple rows, linked as each row says", () => {
    const expected = labels.apple
      .filter((row) => row.collected)
      .map((row) => ({
        NSPrivacyCollectedDataType: row.manifestKey,
        NSPrivacyCollectedDataTypeLinked: row.linked,
        NSPrivacyCollectedDataTypeTracking: row.tracking,
        NSPrivacyCollectedDataTypePurposes: row.purposes.map(manifestPurpose),
      }));
    expect([...privacy.NSPrivacyCollectedDataTypes].sort(byType)).toEqual(expected.sort(byType));
  });

  it('collects every type for App Functionality only, never for tracking, each type once', () => {
    const types = privacy.NSPrivacyCollectedDataTypes.map((e) => e.NSPrivacyCollectedDataType);
    expect(new Set(types).size).toBe(types.length);
    for (const entry of privacy.NSPrivacyCollectedDataTypes) {
      expect(KR15_MANIFEST_KEYS.has(entry.NSPrivacyCollectedDataType)).toBe(true);
      expect(entry.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(entry.NSPrivacyCollectedDataTypePurposes).toEqual([
        manifestPurpose(APP_FUNCTIONALITY),
      ]);
    }
  });

  it("declares only KR15's accessed-API categories, each once, with Apple's reason codes", () => {
    const categories = privacy.NSPrivacyAccessedAPITypes.map((e) => e.NSPrivacyAccessedAPIType);
    expect(new Set(categories).size).toBe(categories.length);
    expect(categories.filter((category) => !KR15_ACCESSED_API_CATEGORIES.has(category))).toEqual(
      [],
    );
    const reasons = privacy.NSPrivacyAccessedAPITypes.flatMap(
      (e) => e.NSPrivacyAccessedAPITypeReasons,
    );
    expect(reasons.filter((reason) => !REASON_CODE.test(reason))).toEqual([]);
  });
});

describe("the installed packages' own privacy manifests (R06)", () => {
  it('scans an install that has every package the lock requires', () => {
    expect(install.missing).toEqual([]);
    expect(install.onDisk.length).toBeGreaterThan(0);
    expect(manifestFiles).toContain(REACT_NATIVE_MANIFEST);
  });

  it.each(manifestFiles)('%s reads as a privacy manifest', (file) => {
    expect(() => readManifest(file)).not.toThrow();
  });

  it('app.json declares every category with every reason any of them declares', () => {
    const declared = new Set(reasonsOf(xcprivacySchema.parse(privacy)));
    const missing = manifestFiles.map(readManifest).flatMap(({ file, manifest }) =>
      reasonsOf(manifest)
        .filter((reason) => !declared.has(reason))
        .map((reason) => `${reason} (${file})`),
    );
    expect(missing).toEqual([]);
  });

  it('none of them tracks or names a tracking domain (KR10)', () => {
    const tracking = manifestFiles
      .map(readManifest)
      .filter(
        ({ manifest }) =>
          manifest.NSPrivacyTracking === true ||
          (manifest.NSPrivacyTrackingDomains ?? []).length > 0,
      )
      .map(({ file }) => file);
    expect(tracking).toEqual([]);
  });

  it('every data type one of them collects is collected in the labels JSON', () => {
    const collected = new Set(
      labels.apple.filter((row) => row.collected).map((r) => r.manifestKey),
    );
    const undeclared = manifestFiles.map(readManifest).flatMap(({ file, manifest }) =>
      (manifest.NSPrivacyCollectedDataTypes ?? [])
        .map((entry) => entry.NSPrivacyCollectedDataType)
        .filter((type) => !collected.has(type))
        .map((type) => `${type} (${file})`),
    );
    expect(undeclared).toEqual([]);
  });
});

describe('Android Auto Backup (critic-security-privacy)', () => {
  it('is off: the cache and the install marker never reach a cloud backup', () => {
    expect(expo.android.allowBackup).toBe(false);
  });
});
