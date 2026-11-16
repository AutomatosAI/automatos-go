// The product-tree reader every app-wide release audit uses (KR4): it finds the repository, lists
// what the app ships and nothing else, and reads a file. An audit over an empty or over-wide list
// would pass or fail for the wrong reason, so each exclusion is proven here. The folders it reads
// and the package it must be are the app's settings (settings/tree.ts, settings/identity.ts); a
// product folder outside the repository is proven on a small tree written to a temp folder.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { APP_IDENTITY } from './settings/identity';
import { AUDIT_TREE, type AuditTree } from './settings/tree';
import {
  copyModules,
  isProductFile,
  productFiles,
  readRepoFile,
  repoRoot,
  stringsModules,
  walkFiles,
} from './support/tree';

const files = productFiles();
const PACKAGE_NAME = APP_IDENTITY.packageName;
const inFolder = (file: string, folders: readonly string[]) =>
  folders.some((folder) => file.startsWith(`${folder}/`));

describe('repoRoot', () => {
  const scratch: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    scratch.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  });

  function cwdIn(packageJson: object): void {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'release-tree-'));
    scratch.push(dir);
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify(packageJson));
    vi.spyOn(process, 'cwd').mockReturnValue(path.join(dir, 'nested'));
  }

  it(`is the ${PACKAGE_NAME} repository`, () => {
    const root = repoRoot();
    expect(JSON.parse(readRepoFile('package.json')).name).toBe(PACKAGE_NAME);
    expect(path.isAbsolute(root)).toBe(true);
  });

  it('climbs from a folder inside the repository', () => {
    const root = repoRoot();
    vi.spyOn(process, 'cwd').mockReturnValue(path.join(root, 'src', 'release'));
    expect(repoRoot()).toBe(root);
  });

  it("throws when the nearest package.json is another package's", () => {
    cwdIn({ name: `not-${PACKAGE_NAME}` });
    expect(() => repoRoot()).toThrow(`'not-${PACKAGE_NAME}', not ${PACKAGE_NAME}`);
  });

  it('throws when the package.json has no name', () => {
    cwdIn({ version: '1.0.0' });
    expect(() => repoRoot()).toThrow(`not ${PACKAGE_NAME}`);
  });
});

describe('isProductFile', () => {
  it.each([
    'src/lib/logger.ts',
    'src/ui/Button.tsx',
    'app/_layout.tsx',
    'app/(app)/settings/index.tsx',
    'src/core/turn.ts',
  ])('ships %s', (file) => {
    expect(isProductFile(file)).toBe(true);
  });

  it.each([
    ['src/core/web/types/chat.ts', 'vendored web code'],
    ['src/chat/__tests__/report.test.ts', 'a test folder'],
    ['src/push/__tests__/source-files.ts', 'a test helper'],
    ['src/core/__fixtures__/turns.ts', 'a fixture folder'],
    ['src/chat/thing.test.ts', 'a test file'],
    ['app/thing.test.tsx', 'a tsx test file'],
    ['src/chat/readme.md', 'not TypeScript'],
    ['scripts/sync-core.ts', 'outside src/ and app/'],
    ['plugins/with-modes.ts', 'outside src/ and app/'],
  ])('leaves out %s (%s)', (file) => {
    expect(isProductFile(file)).toBe(false);
  });
});

describe('productFiles on the merged base', () => {
  it('lists the app: screens and modules from src/ and app/', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain('app/_layout.tsx');
    expect(files).toContain('src/lib/logger.ts');
    expect(files.every((file) => inFolder(file, AUDIT_TREE.productFolders))).toBe(true);
  });

  it('honours every exclusion the tree really has', () => {
    const everything = AUDIT_TREE.productFolders.flatMap((folder) => walkFiles(folder));
    const kinds = [
      (file: string) => inFolder(file, AUDIT_TREE.vendoredFolders),
      (file: string) => file.includes('/__tests__/'),
      (file: string) => file.includes('/__fixtures__/'),
      (file: string) => /\.test\.tsx?$/.test(file),
    ];
    for (const kind of kinds) {
      expect(everything.filter(kind).length).toBeGreaterThan(0);
      expect(files.filter(kind)).toEqual([]);
    }
  });

  it('is sorted, repo-relative and unique', () => {
    expect([...files].sort()).toEqual(files);
    expect(new Set(files).size).toBe(files.length);
    expect(files.some((file) => path.isAbsolute(file))).toBe(false);
  });
});

describe('stringsModules', () => {
  it("lists each feature's strings.ts under src/", () => {
    const modules = stringsModules();
    expect(modules.length).toBeGreaterThan(5);
    expect(modules).toContain('src/chat/strings.ts');
    expect(modules.every((file) => inFolder(file, AUDIT_TREE.copyFolders))).toBe(true);
    expect(modules.every((file) => file.endsWith('/strings.ts'))).toBe(true);
  });
});

describe('readRepoFile', () => {
  it('reads a file by repo-relative path', () => {
    expect(readRepoFile('app/_layout.tsx').length).toBeGreaterThan(0);
  });
});

describe('a product folder outside the repository (rule 14.2)', () => {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'release-tree-shared-'));
  const root = path.join(scratch, 'app');
  const write = (rel: string, text: string) => {
    const file = path.join(scratch, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  // An app in its product's repository: its own src/, and the product's shared source beside it.
  write('app/package.json', JSON.stringify({ name: PACKAGE_NAME }));
  write('app/src/home.tsx', 'export const Home = () => null;');
  write('app/src/strings.ts', "export const HOME = 'Home';");
  write('shared/words/strings.ts', "export const SHARED = 'Shared';");
  write('shared/words/card-copy.ts', "export const CARD = 'Card';");
  write('shared/words/card.tsx', 'export const Card = () => null;');
  write('shared/words/__tests__/card.test.ts', 'export {};');
  write('shared/words/generated/model.ts', 'export {};');
  write('shared/words/notes.md', 'not code');
  const tree: AuditTree = {
    productFolders: ['src', '../shared/words'],
    copyFolders: ['src', '../shared/words'],
    vendoredFolders: ['../shared/words/generated'],
  };

  afterEach(() => vi.restoreAllMocks());
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it('walks it by its path relative to the repository, with the same exclusions', () => {
    expect(productFiles(root, tree)).toEqual([
      '../shared/words/card-copy.ts',
      '../shared/words/card.tsx',
      '../shared/words/strings.ts',
      'src/home.tsx',
      'src/strings.ts',
    ]);
    expect(isProductFile('../shared/words/__tests__/card.test.ts', tree)).toBe(false);
    expect(isProductFile('../shared/words/generated/model.ts', tree)).toBe(false);
    expect(isProductFile('../shared/other/card.tsx', tree)).toBe(false);
  });

  it('reads its words as copy, and a file in it by that path', () => {
    expect(stringsModules(root, tree)).toEqual(['../shared/words/strings.ts', 'src/strings.ts']);
    expect(copyModules(root, tree)).toContain('../shared/words/card-copy.ts');
    expect(readRepoFile('../shared/words/strings.ts', root)).toContain("'Shared'");
  });

  it('finds that repository from a folder inside it', () => {
    vi.spyOn(process, 'cwd').mockReturnValue(path.join(root, 'src'));
    expect(repoRoot()).toBe(root);
  });

  it("reads this app's own tree the same way, by its settings", () => {
    expect(productFiles(repoRoot(), AUDIT_TREE)).toEqual(files);
  });
});
