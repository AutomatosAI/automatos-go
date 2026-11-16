// Settings → Licences (docs/app-standard.md rule 8.3): the rows and the sheet from the list's data,
// the words, and how the screen is wired, read from the source (nothing renders in node): a thin
// route at routes.licences, the one row in Settings' About section after Privacy & legal, a list
// the screen owns, and licences.json required only inside load-licences.ts, so it is never parsed
// at launch. That the committed file is the generator's is scripts/__tests__/release-licences.test.ts.

import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { codeOf } from '../../release/__tests__/support/code';
import { productFiles, readRepoFile, repoRoot } from '../../release/__tests__/support/tree';
import { routes } from '../../navigation/routes';
import {
  licenceLabel,
  licenceRows,
  licenceSheetView,
  licenceText,
  type LicenceData,
  type LicencePackage,
} from '../licences';
import { LICENCES_COPY } from '../strings';

// The source scan reads every product file, as the a11y audit's whole-tree scans do (30 s there too).
const WHOLE_TREE_MS = 30_000;
const MIT_TEXT = 'MIT License\n\nCopyright (c) Someone';
const DATA: LicenceData = {
  note: 'generated',
  packages: [
    { name: '@scope/kit', version: '1.2.3', licence: 'MIT', text: 'aaaaaaaaaaaa' },
    { name: 'bare', version: '0.4.0', licence: 'ISC', text: null },
    { name: 'mystery', version: '2.0.0', licence: null, text: null },
    { name: 'stray', version: '1.0.0', licence: 'MIT', text: 'not-a-key000' },
  ],
  texts: { aaaaaaaaaaaa: MIT_TEXT },
};
const [kit, bare, mystery, stray] = DATA.packages as readonly LicencePackage[];

describe('licenceRows', () => {
  it('gives each package a row: its name over its version and licence, in the file’s order', () => {
    const rows = licenceRows(DATA);
    expect(rows.map((row) => [row.id, row.title, row.summary])).toEqual([
      ['@scope/kit@1.2.3', '@scope/kit', '1.2.3 · MIT'],
      ['bare@0.4.0', 'bare', '0.4.0 · ISC'],
      ['mystery@2.0.0', 'mystery', '2.0.0 · No licence declared'],
      ['stray@1.0.0', 'stray', '1.0.0 · MIT'],
    ]);
    expect(rows[0].entry).toBe(kit);
    expect(Object.isFrozen(rows)).toBe(true);
  });
});

describe('licenceSheetView', () => {
  it('shows the licence file’s text, with no note', () => {
    expect(licenceSheetView(DATA, kit)).toEqual({
      title: '@scope/kit',
      meta: '1.2.3 · MIT',
      text: MIT_TEXT,
      note: null,
    });
  });

  it('says a package ships no licence file, and names the licence it declares', () => {
    expect(licenceSheetView(DATA, bare)).toMatchObject({
      text: null,
      note: 'This package ships no licence file. Its licence is ISC.',
    });
  });

  it('says when a package has neither a licence file nor a declared licence', () => {
    expect(licenceSheetView(DATA, mystery)).toMatchObject({
      meta: '2.0.0 · No licence declared',
      text: null,
      note: LICENCES_COPY.noFileOrLicence,
    });
    expect(licenceLabel(mystery)).toBe(LICENCES_COPY.noLicence);
  });

  it('reads a key that names no text as no text, never a text from the prototype', () => {
    expect(licenceText(DATA, stray)).toBeNull();
    expect(licenceText(DATA, { ...stray, text: 'toString' })).toBeNull();
    expect(Object.isFrozen(licenceSheetView(DATA, kit))).toBe(true);
  });
});

describe('the committed list', () => {
  const data = JSON.parse(readRepoFile('src/about/licences.json')) as LicenceData;

  it('gives every package a row and a sheet with its text or the line that it has none', () => {
    const rows = licenceRows(data);
    expect(rows.length).toBe(data.packages.length);
    rows.forEach((row) => {
      const view = licenceSheetView(data, row.entry);
      expect(view.text ?? view.note, row.id).toMatch(/\S/);
      expect(view.text === null, row.id).toBe(row.entry.text === null);
    });
  });

  it('counts its packages in the lede', () => {
    expect(LICENCES_COPY.lede(data.packages.length)).toContain(
      `${data.packages.length} open-source`,
    );
  });
});

describe('the words', () => {
  it('are frozen and name no product', () => {
    expect(Object.isFrozen(LICENCES_COPY)).toBe(true);
    const words = Object.values(LICENCES_COPY)
      .map((value) => (typeof value === 'function' ? value(2 as never) : value))
      .join('\n');
    expect(words).not.toMatch(/Automatos/);
  });
});

describe('the wiring (source)', () => {
  const ROUTE_FILE = 'app/(app)/settings/licences.tsx';

  it('routes /settings/licences to a thin file that mounts the screen', () => {
    expect(routes.licences).toBe('/settings/licences');
    expect(existsSync(path.join(repoRoot(), ROUTE_FILE))).toBe(true);
    const route = codeOf(ROUTE_FILE);
    expect(route).toContain("from '../../../src/about/LicencesScreen'");
    expect(route).toMatch(/return <LicencesScreen \/>;/);
    expect(route.match(/^import /gm)).toHaveLength(1);
  });

  it('puts the one row in Settings’ About section, after Privacy & legal and before the way out', () => {
    const settings = readRepoFile('app/(app)/settings/index.tsx');
    const privacy = settings.indexOf('<PrivacySection />');
    const about = settings.indexOf('<Section title={LICENCES_COPY.section}>');
    const row = settings.indexOf('router.push(routes.licences)');
    expect(privacy).toBeGreaterThan(-1);
    expect(about).toBeGreaterThan(privacy);
    expect(row).toBeGreaterThan(about);
    expect(settings.indexOf('<RemovePhone />')).toBeGreaterThan(row);
    expect(settings.slice(about, row).match(/<ListRow\b/g)).toHaveLength(1);
  });

  it('owns its list: Screen does not scroll and the rows are a FlatList', () => {
    const screen = codeOf('src/about/LicencesScreen.tsx');
    expect(screen).toMatch(/<Screen>/);
    expect(screen).not.toMatch(/<Screen[^>]*\bscroll\b/);
    expect(screen).toMatch(/<FlatList\b/);
    expect(screen).toContain('<LicenceSheet ');
    expect(screen).toContain('useMemo(loadLicences, [])');
  });

  it(
    'requires licences.json only inside load-licences.ts, so launch never parses it',
    () => {
      const naming = productFiles()
        .filter((file) => readRepoFile(file).includes('licences.json'))
        .filter((file) => codeOf(file).includes('licences.json'));
      expect(naming).toEqual(['src/about/load-licences.ts']);
      const loader = codeOf('src/about/load-licences.ts');
      expect(loader).toMatch(
        /export function loadLicences\(\): LicenceData \{\n\s+return require\('\.\/licences\.json'\) as LicenceData;/,
      );
      expect(loader).not.toMatch(/^import [^t].*licences\.json/m);
    },
    WHOLE_TREE_MS,
  );
});
