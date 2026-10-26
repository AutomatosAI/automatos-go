// R07 and R08 as a test that keeps running in CI (KR12): the build keeps exactly the Android
// permissions docs/release/android-permissions.json allows and none it denies, and its Info.plist
// carries exactly the usage strings docs/release/ios-usage-keys.json records, each one honest. Both
// are read from the evaluated config (expo config --type introspect: every plugin's mods applied),
// so a permission or a key a config plugin adds fails here, not in review; every installed
// library's own AndroidManifest.xml is held to the same list. Photos come from the system photo
// picker with no metadata, and expo-media-library is not installed. Gradle dependencies and remote
// CocoaPods are not in node_modules: the APK (OT-R5) and the IPA scan (US-021h, OT-R4) check them.

import { describe, expect, it } from 'vitest';

import { cameraOptions, libraryOptions, MAX_ATTACHMENTS } from '../../chat/attachments/picked';
import { sectionStartingWith, tableWithColumns } from './support/markdown';
import {
  declaredPackages,
  lockInstall,
  lockPackages,
  readLock,
  readPackageJson,
} from './support/packages';
import {
  androidPermissionsSchema,
  evaluatedConfig,
  iosUsageKeysSchema,
  libraryManifests,
  libraryPermissions,
  manifestPermissions,
  neededSymbol,
  readAndroidPermissions,
  readIosUsageKeys,
  type UsageKey,
} from './support/permissions';
import { productFiles, readRepoFile, repoRoot } from './support/tree';

const permission = (name: string) => `android.permission.${name}`;

// The kit's minimum (US-021g): Play's photo and video policy, storage, location, contacts, the
// overlay and every foreground-service type the app could reach (D33: no background microphone).
const REQUIRED_DENIED = [
  'READ_MEDIA_IMAGES',
  'READ_MEDIA_VIDEO',
  'READ_MEDIA_AUDIO',
  'READ_MEDIA_VISUAL_USER_SELECTED',
  'READ_EXTERNAL_STORAGE',
  'ACCESS_FINE_LOCATION',
  'ACCESS_COARSE_LOCATION',
  'ACCESS_BACKGROUND_LOCATION',
  'READ_CONTACTS',
  'WRITE_CONTACTS',
  'SYSTEM_ALERT_WINDOW',
  'FOREGROUND_SERVICE',
  'FOREGROUND_SERVICE_MICROPHONE',
  'FOREGROUND_SERVICE_MEDIA_PROJECTION',
].map(permission);

const APP_NAME = 'Automatos Go';
const MIN_USED_LENGTH = 30;
const NEVER_ASKS = 'the app never asks for access.';
const USAGE_KEY = /^NS\w+UsageDescription$/;
const NATIVE_MODULES_DOC = 'docs/native-modules.md';
const PICKER = 'expo-image-picker';
const MEDIA_LIBRARY = 'expo-media-library';
// The one file that calls expo-image-picker; picked.ts builds its options (type-only import).
const PICKER_CALLERS = ['src/chat/attachments/pickers.ts'];

const sorted = (items: Iterable<string>) => [...items].sort();
const backticked = (cell: string) => [...cell.matchAll(/`([^`]+)`/g)].map(([, inner]) => inner);

// read once at collection, so introspection and the node_modules walk are not under a timeout
const evaluated = evaluatedConfig();
const android = readAndroidPermissions();
const ios = readIosUsageKeys();
const allowed = android.allowed.map((entry) => entry.name);
const denied = android.denied.map((entry) => entry.name);
const install = lockInstall(readLock(), repoRoot());
const manifests = libraryManifests(install.onDisk);
const product = productFiles().map((file) => ({ file, text: readRepoFile(file) }));

const usageKeysOf = (plist: Readonly<Record<string, unknown>>) =>
  Object.fromEntries(Object.entries(plist).filter(([key]) => USAGE_KEY.test(key)));
const keysOfKind = (kind: UsageKey['kind']) => ios.keys.filter((entry) => entry.kind === kind);

/** The 'Symbols and usage keys' table of docs/native-modules.md, by the key each row covers. */
function nativeModulesRows(): ReadonlyMap<string, string> {
  const section = sectionStartingWith(readRepoFile(NATIVE_MODULES_DOC), 'Symbols and usage keys');
  const table = tableWithColumns(section, ['Framework: class', 'Key']);
  return new Map(table.rows.map((row) => [backticked(row.Key)[0], row['Framework: class']]));
}

describe('the permission records parse (KR12)', () => {
  it('android-permissions.json fits its schema, which refuses an unknown field', () => {
    const extra = { ...android, allowed: [{ ...android.allowed[0], maxSdk: 28 }] };
    expect(androidPermissionsSchema.safeParse(extra).success).toBe(false);
  });

  it('ios-usage-keys.json fits its schema, which refuses an unknown field or a bare empty needs', () => {
    const extra = { ...ios, keys: [{ ...ios.keys[0], plugin: 'x' }] };
    expect(iosUsageKeysSchema.safeParse(extra).success).toBe(false);
    const bare = { ...ios, keys: [{ ...ios.keys[0], needs: [], note: undefined }] };
    expect(iosUsageKeysSchema.safeParse(bare).success).toBe(false);
  });
});

describe('the Android manifest asks for exactly what the app uses (R08, KR12)', () => {
  it('keeps exactly the allowed permissions: one a plugin adds fails here', () => {
    expect(sorted(evaluated.kept)).toEqual(sorted(allowed));
  });

  it('lists each permission once, never both allowed and denied', () => {
    expect(new Set(allowed).size).toBe(allowed.length);
    expect(new Set(denied).size).toBe(denied.length);
    expect(allowed.filter((name) => denied.includes(name))).toEqual([]);
  });

  it("denies at least the kit's list: READ_MEDIA_*, storage, location, contacts, overlay, services", () => {
    expect(REQUIRED_DENIED.filter((name) => !denied.includes(name))).toEqual([]);
  });

  it('keeps none of the denied permissions', () => {
    expect(evaluated.kept.filter((name) => denied.includes(name))).toEqual([]);
  });

  it('records why for every permission the manifest removes (app.json blockedPermissions)', () => {
    expect(evaluated.removed.length).toBeGreaterThan(0);
    expect(evaluated.removed.filter((name) => !denied.includes(name))).toEqual([]);
  });
});

describe("the installed libraries' own Android manifests (R08)", () => {
  it('scans every package the lock requires, the picker and LiveKit included', () => {
    expect(install.missing).toEqual([]);
    expect(manifests).toEqual(
      expect.arrayContaining([
        `node_modules/${PICKER}/android/src/main/AndroidManifest.xml`,
        'node_modules/@livekit/react-native/android/src/main/AndroidManifest.xml',
      ]),
    );
  });

  it('reads uses-permission and uses-permission-sdk-23, skipping comments', () => {
    const xml = `<manifest>
      <!-- <uses-permission android:name="android.permission.READ_CONTACTS" /> -->
      <uses-permission android:name="android.permission.CAMERA" />
      <uses-permission-sdk-23
        android:name="android.permission.WAKE_LOCK"/>
      <service android:permission="android.permission.BIND_JOB_SERVICE" />
    </manifest>`;
    expect(manifestPermissions(xml)).toEqual([permission('CAMERA'), permission('WAKE_LOCK')]);
  });

  it('declare only allowed permissions, or ones the app manifest removes at merge', () => {
    const declared = libraryPermissions(manifests);
    expect(declared.map((entry) => entry.name)).toContain(permission('READ_EXTERNAL_STORAGE'));
    const unmerged = declared
      .filter(({ name }) => !allowed.includes(name) && !evaluated.removed.includes(name))
      .map(({ name, file }) => `${name} (${file})`);
    expect(unmerged).toEqual([]);
  });
});

describe('the iOS usage strings (R07, ITMS-90683)', () => {
  it("Info.plist's usage keys and strings are exactly ios-usage-keys.json's", () => {
    const recorded = Object.fromEntries(ios.keys.map((entry) => [entry.key, entry.string]));
    expect(usageKeysOf(evaluated.infoPlist)).toEqual(recorded);
    expect(ios.keys).toHaveLength(Object.keys(recorded).length);
  });

  it.each(keysOfKind('used').map((entry) => [entry.key, entry.string]))(
    '%s names Automatos Go, says what for and is 30+ characters',
    (_key, value) => {
      expect(value).toContain(APP_NAME);
      expect(value.length).toBeGreaterThanOrEqual(MIN_USED_LENGTH);
      expect(value).not.toContain(NEVER_ASKS);
    },
  );

  it.each(keysOfKind('notice').map((entry) => [entry.key, entry.string]))(
    '%s says the app does not use it and never asks',
    (_key, value) => {
      expect(value).toMatch(new RegExp(`^${APP_NAME} does not `));
      expect(value).toContain(NEVER_ASKS);
    },
  );

  it("names the classes docs/native-modules.md maps to each key, and the doc's keys are these", () => {
    const rows = nativeModulesRows();
    expect(sorted(rows.keys())).toEqual(sorted(ios.keys.map((entry) => entry.key)));
    for (const entry of ios.keys) {
      const cell = rows.get(entry.key) ?? '';
      expect(sorted(entry.needs.map(neededSymbol)), entry.key).toEqual(sorted(backticked(cell)));
      for (const need of entry.needs) expect(cell).toContain(need.split(':')[0]);
    }
  });

  it("lists, once, every key whose string differs from A.3's proposal or that A.3 lacks", () => {
    const differing = ios.keys
      .filter((entry) => entry.proposed !== entry.string)
      .map((entry) => entry.key);
    expect(sorted(ios.differences.map((entry) => entry.key))).toEqual(sorted(differing));
  });

  it('keeps remote-notification as the only background mode: no audio (D33)', () => {
    expect(evaluated.infoPlist.UIBackgroundModes).toEqual(['remote-notification']);
  });

  it('never allows arbitrary loads (App Transport Security)', () => {
    const ats = (evaluated.infoPlist.NSAppTransportSecurity ?? {}) as Record<string, unknown>;
    expect(Object.keys(ats).filter((key) => key.startsWith('NSAllowsArbitraryLoads'))).toEqual([]);
  });
});

describe('photos come from the system picker, without metadata (R08, US-009b)', () => {
  it('no product file passes legacy: true or exif: true', () => {
    const offenders = product
      .filter(({ text }) => /\b(legacy|exif)\s*:\s*true\b/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it(`only ${PICKER_CALLERS.join(', ')} imports ${PICKER} as a value`, () => {
    const importsPicker = (text: string) =>
      [...text.matchAll(new RegExp(`import\\s+(type\\s+)?[^;]*?from\\s+'${PICKER}'`, 'g'))].some(
        ([, typeOnly]) => typeOnly === undefined,
      ) || new RegExp(`(require|import)\\(\\s*'${PICKER}'\\s*\\)`).test(text);
    const callers = product.filter(({ text }) => importsPicker(text)).map(({ file }) => file);
    expect(callers).toEqual(PICKER_CALLERS);
  });

  it("every camera and library launch passes picked.ts's options", () => {
    const calls = (pattern: RegExp) =>
      product.reduce((sum, { text }) => sum + (text.match(pattern) ?? []).length, 0);
    expect(calls(/launchCameraAsync\(/g)).toBe(calls(/launchCameraAsync\(cameraOptions\(\)\)/g));
    expect(calls(/launchImageLibraryAsync\(/g)).toBe(
      calls(/launchImageLibraryAsync\(libraryOptions\(\w+\)\)/g),
    );
    expect(calls(/launchImageLibraryAsync\(/g)).toBeGreaterThan(0);
  });

  it('those options ask for no metadata, and the library for the system picker', () => {
    expect(cameraOptions()).toMatchObject({ exif: false, mediaTypes: ['images'] });
    for (const limit of [1, MAX_ATTACHMENTS]) {
      expect(libraryOptions(limit)).toMatchObject({ exif: false, legacy: false });
    }
  });

  it(`${MEDIA_LIBRARY} is neither declared nor installed`, () => {
    const names = [...declaredPackages(readPackageJson()), ...lockPackages(readLock())].flatMap(
      (entry) => entry.names,
    );
    expect(names).not.toContain(MEDIA_LIBRARY);
  });
});
