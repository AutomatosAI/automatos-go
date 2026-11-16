// Settings → Licences (docs/app-standard.md rule 8.3) as a test that keeps running in CI: the list
// the app shows, src/about/licences.json, is what scripts/generate-licences.mjs writes from today's
// package-lock.json and node_modules, so a dependency added, removed or updated without running the
// script fails here with the command to run. Every package has a name, a version and a licence id;
// none ships without a licence, or as UNLICENSED, unless NO_LICENCE_ALLOWED names it with its reason;
// and the kinds of licence the app ships are pinned in LICENCE_IDS (both in the app's settings,
// src/release/__tests__/settings/release-licences.ts), so a new one is read by a person before it
// ships. The generator's own rules are proved on small installs written to a temp folder.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  LICENCE_IDS,
  NO_LICENCE_ALLOWED,
} from '../../src/release/__tests__/settings/release-licences';
import { readRepoFile, repoRoot } from '../../src/release/__tests__/support/tree';
import {
  GENERATED_NOTE,
  LicenceError,
  MAX_TEXT_BYTES,
  OUTPUT_PATH,
  TEXT_KEY_LENGTH,
  buildLicenceData,
  checkedKey,
  declaredLicence,
  installReader,
  licenceData,
  licenceFiles,
  normaliseText,
  run,
  serialise,
  textKey,
} from '../generate-licences.mjs';

const COMMAND = 'node scripts/generate-licences.mjs';
const OUT_OF_DATE = `${OUTPUT_PATH} is not what the generator writes from package-lock.json and node_modules. Run ${COMMAND} and commit the file with the lockfile.`;
// Reading every installed package's files is slower than vitest's 5 s default on a cold disk.
const WHOLE_INSTALL_MS = 60_000;
const LISTED_AT_MOST = 20;

// The kinds of licence the app ships (LICENCE_IDS) and the packages allowed to ship without one
// (NO_LICENCE_ALLOWED), each with its reason, are the app's (settings/release-licences.ts).
const LICENCE_KINDS = LICENCE_IDS.entries;

/** The list as the generator types it: the shape src/about/licences.ts reads. */
type LicenceData = ReturnType<typeof buildLicenceData>;
type LicencePackage = LicenceData['packages'][number];

const UNLICENSED = /^unlicen[cs]ed$/i;
const committedText = readRepoFile(OUTPUT_PATH);
const committed = JSON.parse(committedText) as LicenceData;
let freshData: LicenceData | null = null;

/** The list as the generator builds it now, from this checkout's lockfile and install. */
function fresh(): LicenceData {
  freshData ??= licenceData(repoRoot());
  return freshData;
}

const idOf = (entry: LicencePackage) => `${entry.name}@${entry.version}`;
const few = (ids: readonly string[]) =>
  ids.length > LISTED_AT_MOST
    ? `${ids.slice(0, LISTED_AT_MOST).join(', ')} and ${ids.length - LISTED_AT_MOST} more`
    : ids.join(', ');

/** What differs between two lists, a line per kind, so a failure names the packages. */
function drift(was: LicenceData, now: LicenceData): string[] {
  const before = new Map(was.packages.map((entry) => [idOf(entry), entry]));
  const after = new Map(now.packages.map((entry) => [idOf(entry), entry]));
  const added = [...after.keys()].filter((id) => !before.has(id));
  const removed = [...before.keys()].filter((id) => !after.has(id));
  const changed = [...after.keys()].filter(
    (id) => before.has(id) && JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id)),
  );
  const others = [
    JSON.stringify(was.texts) === JSON.stringify(now.texts) ? null : 'the texts',
    was.note === now.note ? null : 'the note',
  ];
  return [
    added.length > 0 ? `not listed: ${few(added)}` : null,
    removed.length > 0 ? `no longer installed: ${few(removed)}` : null,
    changed.length > 0 ? `licence or text changed: ${few(changed)}` : null,
    ...others,
  ].filter((line): line is string => line !== null);
}

describe('src/about/licences.json', () => {
  it(
    'is what the generator writes from the lockfile and node_modules today',
    () => {
      expect(drift(committed, fresh()).join('\n'), OUT_OF_DATE).toBe('');
      expect(committedText === serialise(fresh()), OUT_OF_DATE).toBe(true);
    },
    WHOLE_INSTALL_MS,
  );

  it('holds no path of the machine that wrote it', () => {
    const root = repoRoot();
    [root, realpathSync(root), os.homedir(), path.join(root, 'node_modules')].forEach((place) =>
      expect(committedText).not.toContain(place),
    );
  });

  it('refers to every text by its key, and holds no text nothing refers to', () => {
    const keys = Object.keys(committed.texts);
    const used = new Set(
      committed.packages.map((entry) => entry.text).filter((key) => key !== null),
    );
    expect([...used].filter((key) => !keys.includes(key))).toEqual([]);
    expect(keys.filter((key) => !used.has(key))).toEqual([]);
    keys.forEach((key) => {
      expect(key).toHaveLength(TEXT_KEY_LENGTH);
      expect(textKey(committed.texts[key]), key).toBe(key);
    });
    expect(committed.note).toBe(GENERATED_NOTE);
  });

  it('lists each package once, by name then version', () => {
    const ids = committed.packages.map(idOf);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(100);
    const names = committed.packages.map((entry) => entry.name);
    expect([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(names);
  });
});

describe('every package the app ships', () => {
  const allowed = new Set(NO_LICENCE_ALLOWED.map((entry) => entry.name));
  const unlicensed = committed.packages.filter(
    (entry) => entry.licence === null || UNLICENSED.test(entry.licence.trim()),
  );

  it('has a name, a version and a licence id', () => {
    committed.packages.forEach((entry) => {
      expect(entry.name, idOf(entry)).toMatch(/\S/);
      expect(entry.version, idOf(entry)).toMatch(/^\d+\.\d+\.\d+/);
      expect(entry.licence === null || /\S/.test(entry.licence), idOf(entry)).toBe(true);
    });
  });

  it('declares a licence that lets the app ship it, but where NO_LICENCE_ALLOWED says why', () => {
    const found = unlicensed.filter((entry) => !allowed.has(entry.name)).map(idOf);
    expect(found).toEqual([]);
  });

  it('allows only a package that is there without a licence (no stale entry), with a reason', () => {
    const shown = new Set(unlicensed.map((entry) => entry.name));
    expect(NO_LICENCE_ALLOWED.filter((entry) => !shown.has(entry.name))).toEqual([]);
    NO_LICENCE_ALLOWED.forEach((entry) =>
      expect(entry.reason.length, entry.name).toBeGreaterThan(60),
    );
  });

  it('is under a licence a person has read: a new kind fails until LICENCE_IDS names it', () => {
    const ids = [...new Set(committed.packages.map((entry) => entry.licence ?? ''))]
      .filter((id) => id !== '')
      .sort();
    const fresh = ids.filter((id) => !LICENCE_KINDS.includes(id));
    expect(fresh, 'A new kind of licence: read it before it ships (see LICENCE_IDS)').toEqual([]);
    expect(
      LICENCE_KINDS.filter((id) => !ids.includes(id)),
      'No package has it now',
    ).toEqual([]);
  });
});

// ── the generator's rules, on small installs ───────────────────────────────────────────────

const scratch = mkdtempSync(path.join(os.tmpdir(), 'release-licences-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

type Fake = {
  readonly key: string;
  readonly entry: Record<string, unknown>;
  readonly manifest?: Record<string, unknown>;
  readonly files?: Readonly<Record<string, string>>;
};

const MIT = 'MIT License\n\nCopyright (c) A';
const FAKES: readonly Fake[] = [
  { key: 'node_modules/zed', entry: { version: '1.0.0', license: 'MIT' }, files: { LICENSE: MIT } },
  {
    key: 'node_modules/alpha',
    entry: { version: '2.0.0' },
    manifest: { license: 'ISC' },
    files: { 'license.md': 'ISC text', NOTICE: 'A notice', 'licenses.json': '{}' },
  },
  {
    key: 'node_modules/alpha/node_modules/zed',
    entry: { version: '1.0.0' },
    files: { LICENCE: MIT },
  },
  { key: 'node_modules/zed/node_modules/alpha', entry: { version: '1.5.0' } },
  { key: 'node_modules/dev-only', entry: { version: '1.0.0', dev: true } },
  {
    key: 'node_modules/tool-darwin-arm64',
    entry: { version: '1.0.0', optional: true, os: ['darwin'], cpu: ['arm64'] },
  },
];

/** A fake install on disk: package-lock.json and node_modules, each package with its files. */
function writeInstall(fakes: readonly Fake[], name: string): string {
  const root = path.join(scratch, name);
  const packages: Record<string, unknown> = { '': { name: 'app', version: '0.1.0' } };
  fakes.forEach(({ key, entry, manifest, files }) => {
    packages[key] = entry;
    const dir = path.join(root, ...key.split('/'));
    mkdirSync(dir, { recursive: true });
    const own = { name: key.slice(key.lastIndexOf('node_modules/') + 13), version: entry.version };
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ ...own, ...entry, ...manifest }),
    );
    Object.entries(files ?? {}).forEach(([file, text]) =>
      writeFileSync(path.join(dir, file), text),
    );
  });
  writeFileSync(
    path.join(root, 'package-lock.json'),
    JSON.stringify({ lockfileVersion: 3, packages }),
  );
  return root;
}

describe('the generator', () => {
  const built = licenceData(writeInstall(FAKES, 'plain'));

  it('lists what ships: not dev, not a platform binary, not the app; one entry per version', () => {
    expect(built.packages.map(idOf)).toEqual(['alpha@1.5.0', 'alpha@2.0.0', 'zed@1.0.0']);
  });

  it('stores each text once, licences before a notice, and none for a package without', () => {
    const [noFile, alpha, zed] = built.packages;
    expect(noFile.text).toBeNull();
    expect(built.texts[alpha.text ?? '']).toBe('ISC text\n\nA notice');
    expect(built.texts[zed.text ?? '']).toBe(MIT);
    expect(Object.keys(built.texts)).toHaveLength(2);
  });

  it('writes the same bytes whatever order the lockfile and the folder list things in', () => {
    const reversed = licenceData(writeInstall([...FAKES].reverse(), 'reversed'));
    expect(serialise(reversed)).toBe(serialise(built));
    expect(serialise(built)).toBe(serialise(licenceData(writeInstall(FAKES, 'again'))));
  });

  it('reads the same through a linked node_modules as through the real folder', () => {
    const real = writeInstall(FAKES, 'linked-target');
    const linked = path.join(scratch, 'linked');
    mkdirSync(linked);
    const lock = readFileSync(path.join(real, 'package-lock.json'), 'utf8');
    writeFileSync(path.join(linked, 'package-lock.json'), lock);
    symlinkSync(path.join(real, 'node_modules'), path.join(linked, 'node_modules'), 'dir');
    expect(serialise(licenceData(linked))).toBe(serialise(licenceData(real)));
  });

  it('refuses an install that is not the lockfile’s, and says to run npm ci', () => {
    const stale = writeInstall(
      [{ key: 'node_modules/zed', entry: { version: '1.0.0' }, manifest: { version: '1.0.1' } }],
      'stale',
    );
    expect(() => licenceData(stale)).toThrow(LicenceError);
    expect(() => licenceData(stale)).toThrow(/npm ci/);
    const lock = { packages: { 'node_modules/gone': { version: '1.0.0' } } };
    expect(() => buildLicenceData(lock, installReader(path.join(stale, 'node_modules')))).toThrow(
      /not installed/,
    );
  });
});

describe('what the generator reads from a package', () => {
  it.each([
    [{ license: ' MIT ' }, 'MIT'],
    [{ license: { type: 'BSD-3-Clause' } }, 'BSD-3-Clause'],
    [{ licenses: 'MIT' }, 'MIT'],
    [{ licenses: [{ type: 'Apache 2.0' }] }, 'Apache 2.0'],
    [{ licenses: [{ type: 'MIT' }, 'GPL-2.0'] }, '(MIT OR GPL-2.0)'],
    [{ license: '' }, null],
    [{}, null],
  ])('declares %j as %j', (manifest, licence) => {
    expect(declaredLicence(manifest)).toBe(licence);
  });

  it('takes the licence files in any case and spelling, a notice after them, and no code', () => {
    const names = ['README.md', 'NOTICE', 'license', 'LICENSE-MIT.txt', 'COPYING', 'licence.js'];
    expect(licenceFiles([...names, 'UNLICENSE', 'Licence.md', 'license-checker.json'])).toEqual([
      'COPYING',
      'LICENSE-MIT.txt',
      'Licence.md',
      'UNLICENSE',
      'license',
      'NOTICE',
    ]);
  });

  it('keeps a text whole but for its byte-order mark, line ends and trailing spaces', () => {
    expect(normaliseText('\uFEFF\r\nMIT  \r\n\r\nCopyright\r\n\n')).toBe('MIT\n\nCopyright');
  });
});

// Since 16 Nov: a lockfile key is joined into the path files are read from, and the list ships in
// the app, so a key that leaves the repository and a text of any size are refused, by name.
describe('what the generator refuses', () => {
  const neverRead = () => {
    throw new Error('read before the key was checked');
  };

  it.each([
    'node_modules/../../outside',
    'node_modules/a/../../../etc',
    'node_modules//a',
    'node_modules/a/',
    'node_modules\\a',
    '/abs/node_modules/a',
    'C:/node_modules/a',
  ])('a lockfile key %j, named in the error, before anything is read', (key) => {
    const lock = { packages: { '': {}, [key]: { version: '1.0.0' } } };
    expect(() => buildLicenceData(lock, neverRead)).toThrow(LicenceError);
    expect(() => buildLicenceData(lock, neverRead)).toThrow(JSON.stringify(key));
    expect(() => installReader(scratch)(key)).toThrow(JSON.stringify(key));
  });

  it("checks every key, a dev package's too, and passes a nested, scoped one", () => {
    const lock = { packages: { 'node_modules/../tool': { version: '1.0.0', dev: true } } };
    expect(() => buildLicenceData(lock, neverRead)).toThrow(LicenceError);
    const nested = 'node_modules/a/node_modules/@scope/b';
    expect(checkedKey(nested)).toBe(nested);
  });

  it('fails the run on a text over MAX_TEXT_BYTES, naming the package, and never cuts one', () => {
    const install = (text: string, name: string) =>
      writeInstall(
        [{ key: 'node_modules/big', entry: { version: '1.0.0' }, files: { LICENSE: text } }],
        name,
      );
    const whole = 'x'.repeat(MAX_TEXT_BYTES);
    const fits = licenceData(install(whole, 'cap-at'));
    expect(fits.texts[fits.packages[0]?.text ?? '']).toBe(whole);
    const over = install(`${whole}x`, 'cap-over');
    expect(() => licenceData(over)).toThrow(LicenceError);
    const named = /^node_modules\/big \(big@1\.0\.0\): .* over MAX_TEXT_BYTES/;
    expect(() => licenceData(over)).toThrow(named);
    expect(run(over, () => true)).toBe(1);
    expect(existsSync(path.join(over, OUTPUT_PATH))).toBe(false);
  });

  it("sets the cap well above today's longest text", () => {
    const sizes = Object.values(committed.texts).map((text) => Buffer.byteLength(text, 'utf8'));
    expect(Math.max(...sizes) * 3).toBeLessThan(MAX_TEXT_BYTES);
  });
});
