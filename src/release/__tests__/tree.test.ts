// The product-tree reader every app-wide release audit uses (KR4): it finds the repository, lists
// what the app ships and nothing else, and reads a file. An audit over an empty or over-wide list
// would pass or fail for the wrong reason, so each exclusion is proven here.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isProductFile,
  productFiles,
  readRepoFile,
  repoRoot,
  stringsModules,
  walkFiles,
} from './support/tree';

const files = productFiles();

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

  it('is the automatos-go repository', () => {
    const root = repoRoot();
    expect(JSON.parse(readRepoFile('package.json')).name).toBe('automatos-go');
    expect(path.isAbsolute(root)).toBe(true);
  });

  it('climbs from a folder inside the repository', () => {
    const root = repoRoot();
    vi.spyOn(process, 'cwd').mockReturnValue(path.join(root, 'src', 'release'));
    expect(repoRoot()).toBe(root);
  });

  it("throws when the nearest package.json is another package's", () => {
    cwdIn({ name: 'not-automatos-go' });
    expect(() => repoRoot()).toThrow(/'not-automatos-go', not automatos-go/);
  });

  it('throws when the package.json has no name', () => {
    cwdIn({ version: '1.0.0' });
    expect(() => repoRoot()).toThrow(/not automatos-go/);
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
    expect(files.every((file) => file.startsWith('src/') || file.startsWith('app/'))).toBe(true);
  });

  it('honours every exclusion the tree really has', () => {
    const everything = [...walkFiles('src'), ...walkFiles('app')];
    const kinds = [
      (file: string) => file.startsWith('src/core/web/'),
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
    expect(modules.every((file) => /^src\/(.+\/)?strings\.ts$/.test(file))).toBe(true);
  });
});

describe('readRepoFile', () => {
  it('reads a file by repo-relative path', () => {
    expect(readRepoFile('app/_layout.tsx').length).toBeGreaterThan(0);
  });
});
