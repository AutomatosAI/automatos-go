// The app's audit settings themselves (docs/app-standard.md rule 14.2, settings/): every allowed
// list carries its reasons, the entries no audit checks for staleness still name a file that exists
// and text that is still in it, the folders the walkers read are written as the walkers read them,
// and no audit keeps a private copy of a value that moved into the settings. The stale checks the
// audits already make are theirs and are not repeated here.

import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ALLOWED_LISTS, APP_IDENTITY, AUDIT_TREE } from './settings';
import { ICON_SET } from './settings/a11y-audit';
import { FORWARDERS, PORT_WRITES } from './settings/secure-store-audit';
import { readRepoFile, repoRoot, walkFiles } from './support/tree';

const SETTINGS_DIR = 'src/release/__tests__/settings';
const THIS_FILE = 'src/release/__tests__/audit-settings.test.ts';
const LEAST_REASON = 20;

/** The audits: every file that reads the settings in place of a constant of its own. */
function auditFiles(): string[] {
  const release = walkFiles('src/release/__tests__').filter(
    (file) => !file.startsWith(`${SETTINGS_DIR}/`) && file !== THIS_FILE,
  );
  const config = walkFiles('src/config/__tests__');
  const scripts = walkFiles('scripts/__tests__').filter((file) =>
    /\/release-[\w-]+\.test\.ts$/.test(file),
  );
  return [
    ...release,
    ...config,
    ...scripts,
    'src/styles/__tests__/contrast.test.ts',
    'src/styles/contrast.ts',
  ].filter((file) => /\.tsx?$/.test(file));
}

/** The names the moved constants had in the audits, each now in a settings file. */
const MOVED_NAMES: readonly string[] = [
  'PACKAGE_NAME',
  'PRODUCT_DIRS',
  'VENDORED_WEB',
  'APP_NAME',
  'BUNDLE_ID',
  'EAS_OWNER',
  'EAS_PROJECT_ID',
  'PUBLIC_ADDRESS',
  'CREAM',
  'DARK',
  'SPLASH_IMAGE_WIDTH',
  'PUBLIC_ADDRESSES',
  'ALLOWED',
  'STYLE_CHROME',
  'ALLOWED_AGES',
  'RULED_OUT_TERMS',
  'REVIEW_LABELS',
  'SEND_SURFACES',
  'REPORT_MOUNTS',
  'AUTO_MESSAGES',
  'UPLOAD_PATHS',
  'ADAPTERS',
  'WRITE_OPTIONS',
  'FORWARDERS',
  'PORT_WRITES',
  'SHOWN',
  'OUT_OF_DATE_LINES',
  'OWED',
  'ALLOWED_WEB_VIEW_MENTIONS',
  'LICENCE_IDS',
  'NO_LICENCE_ALLOWED',
  'PICKER_CALLERS',
  'TEXT_ON',
  'KNOWN',
  'PALETTES',
  'USED_KEYS',
  'REFERENCED_ONLY_KEYS',
  'UNREFERENCED_KEYS',
  'REQUIRED_KEYS',
  'ANDROID_PERMISSIONS',
  'ANDROID_BLOCKED',
  'LINKED_TYPES',
  'NOT_LINKED_TYPES',
  'NEVER_DECLARED',
  'NOT_THIN',
  'PRESENT_FROM_START',
  'LUCIDE',
];

/** A declaration of `name` given a value of its own: a literal, a list, an object or a set. */
const ownValue = (name: string) =>
  new RegExp(
    `\\b(?:const|let|var)\\s+${name}\\b[^=;]*=\\s*(?:['"\`\\[{\\d/]|-\\d|Object\\.freeze\\(|new Set\\()`,
  );

/** The identity's values no audit spells itself: each is read from settings/identity.ts. */
const IDENTITY_VALUES: readonly string[] = [
  APP_IDENTITY.bundleId,
  APP_IDENTITY.links.applinks,
  APP_IDENTITY.links.webcredentials,
  APP_IDENTITY.eas.owner,
  APP_IDENTITY.eas.projectId,
  APP_IDENTITY.eas.appleTeamId,
  APP_IDENTITY.eas.ascAppId,
  APP_IDENTITY.publicRepository,
  ...Object.values(APP_IDENTITY.legalPages),
];

const reasonOf = (entry: unknown): string => {
  if (typeof entry !== 'object' || entry === null) return '';
  const { reason, why } = entry as { reason?: unknown; why?: unknown };
  return [reason, why].find((each): each is string => typeof each === 'string') ?? '';
};

describe('every allowed list carries its reasons', () => {
  it('registers each list once, under its audit', () => {
    const names = ALLOWED_LISTS.map((list) => `${list.audit} ${list.name}`);
    expect(new Set(names).size).toBe(names.length);
    expect(ALLOWED_LISTS.length).toBeGreaterThanOrEqual(15);
  });

  it.each(ALLOWED_LISTS.map((list) => [`${list.audit} ${list.name}`, list] as const))(
    '%s: no entry lacks a reason',
    (_name, list) => {
      if (list.reason !== undefined) {
        expect(list.reason.trim().length).toBeGreaterThan(LEAST_REASON);
        return;
      }
      const bare = list.entries.filter((entry) => reasonOf(entry).trim().length < LEAST_REASON);
      expect(bare).toEqual([]);
    },
  );

  it('is frozen, list and entries', () => {
    for (const list of ALLOWED_LISTS) {
      expect(Object.isFrozen(list.entries), list.name).toBe(true);
      list.entries.forEach((entry) => {
        if (typeof entry === 'object' && entry !== null) expect(Object.isFrozen(entry)).toBe(true);
      });
    }
    expect(Object.isFrozen(APP_IDENTITY.links.pathPrefixes)).toBe(true);
  });
});

describe('the entries no audit checks for staleness', () => {
  // secure-store-audit.test.ts accepts a call these lists name, but never asks that each is still
  // made: the file, and the key or the port it passes on, must still be there.
  it.each(FORWARDERS.map((entry) => [entry.file, entry.arg] as const))(
    '%s still passes on %s',
    (file, arg) => {
      expect(existsSync(path.join(repoRoot(), file))).toBe(true);
      expect(readRepoFile(file)).toContain(arg);
    },
  );

  it.each(PORT_WRITES.map((entry) => [entry.file, entry.receiver] as const))(
    '%s still writes through %s',
    (file, receiver) => {
      expect(existsSync(path.join(repoRoot(), file))).toBe(true);
      expect(readRepoFile(file)).toContain(receiver);
    },
  );
});

describe('the folders the walkers read', () => {
  const { productFolders, copyFolders, vendoredFolders } = AUDIT_TREE;

  it('are written relative to the repository, in posix form, with no trailing slash', () => {
    for (const folder of [...productFolders, ...copyFolders, ...vendoredFolders]) {
      expect(path.posix.isAbsolute(folder), folder).toBe(false);
      expect(path.posix.normalize(folder), folder).toBe(folder);
      expect(folder, folder).not.toMatch(/\\|\/$|^\.$/);
    }
  });

  it('read the copy and the vendored code inside the product folders, and each folder exists', () => {
    const inside = (folder: string) =>
      productFolders.some((product) => folder === product || folder.startsWith(`${product}/`));
    expect([...copyFolders, ...vendoredFolders].filter((folder) => !inside(folder))).toEqual([]);
    for (const folder of productFolders) {
      expect(existsSync(path.join(repoRoot(), folder)), folder).toBe(true);
    }
  });
});

describe('no audit keeps a private copy of what moved', () => {
  const audits = auditFiles().map((file) => ({ file, text: readRepoFile(file) }));

  it('reads every audit and its support files', () => {
    expect(audits.length).toBeGreaterThan(50);
    expect(audits.map((each) => each.file)).toContain('src/config/__tests__/app-config.test.ts');
    expect(audits.map((each) => each.file)).toContain('scripts/__tests__/release-licences.test.ts');
  });

  it('declares none of the moved names with a value of its own', () => {
    const found = audits.flatMap(({ file, text }) =>
      MOVED_NAMES.filter((name) => ownValue(name).test(text)).map((name) => `${file}: ${name}`),
    );
    expect(found).toEqual([]);
  });

  it("spells none of the app's identity: it reads settings/identity.ts", () => {
    const found = audits.flatMap(({ file, text }) =>
      IDENTITY_VALUES.filter((value) => text.includes(value)).map((value) => `${file}: ${value}`),
    );
    expect(found).toEqual([]);
  });

  it('names the icon set only through settings/a11y-audit.ts', () => {
    const found = audits.filter(({ text }) => text.includes(ICON_SET)).map(({ file }) => file);
    expect(found).toEqual([]);
  });

  it('the scan finds a private copy written either way', () => {
    expect(ownValue('BUNDLE_ID').test("const BUNDLE_ID = 'com.example.app';")).toBe(true);
    expect(ownValue('OWED').test('const OWED: readonly Owed[] = [')).toBe(true);
    expect(ownValue('KNOWN').test('export const KNOWN = Object.freeze([')).toBe(true);
    expect(ownValue('BUNDLE_ID').test('const BUNDLE_ID = APP_IDENTITY.bundleId;')).toBe(false);
    expect(ownValue('ADAPTERS').test('const ADAPTERS = ADAPTER_FILES.entries;')).toBe(false);
  });
});
