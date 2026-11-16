// The product tree the release audits read (KR4): every .ts and .tsx file the app ships, from the
// repository itself, never from a module import. Which folders those are, and the package the
// repository must be, are the app's settings (settings/tree.ts, settings/identity.ts); a product
// folder outside the repository is read through its path relative to it. Test-only (node:fs and
// node:path): it lives under __tests__/ so no screen can import it and it never reaches the bundle.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { APP_IDENTITY } from '../settings/identity';
import { AUDIT_TREE, type AuditTree } from '../settings/tree';

const SOURCE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const TEST_DIRS = ['__tests__', '__fixtures__'];

/** The repository root: the nearest folder at or above process.cwd() with a package.json. */
export function repoRoot(): string {
  return findRoot(process.cwd(), process.cwd());
}

function findRoot(dir: string, start: string): string {
  const name = packageName(dir);
  if (name !== undefined) {
    if (name !== APP_IDENTITY.packageName) {
      throw new Error(
        `${dir}/package.json is '${name}', not ${APP_IDENTITY.packageName}: run from the repo`,
      );
    }
    return dir;
  }
  const parent = path.dirname(dir);
  if (parent === dir) throw new Error(`no package.json at or above ${start}`);
  return findRoot(parent, start);
}

function packageName(dir: string): string | undefined {
  const file = path.join(dir, 'package.json');
  if (!existsSync(file)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const name = (parsed as { name?: unknown }).name;
  return typeof name === 'string' ? name : '';
}

/** Every file under a repo-relative folder, as sorted repo-relative posix paths. */
export function walkFiles(relDir: string, root: string = repoRoot()): string[] {
  const walk = (rel: string): string[] =>
    readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap((entry) => {
      const child = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) return walk(child);
      return entry.isFile() ? [child] : [];
    });
  return walk(relDir).sort();
}

const under = (relPath: string, folders: readonly string[]) =>
  folders.some((folder) => relPath.startsWith(`${folder}/`));

/** True for a .ts/.tsx file the app ships: in a product folder, not vendored code, not a test. */
export function isProductFile(relPath: string, tree: AuditTree = AUDIT_TREE): boolean {
  if (!under(relPath, tree.productFolders)) return false;
  if (!SOURCE.test(relPath) || TEST_FILE.test(relPath)) return false;
  if (under(relPath, tree.vendoredFolders)) return false;
  const folders = relPath.split('/').slice(0, -1);
  return !folders.some((folder) => TEST_DIRS.includes(folder));
}

/** Every product .ts/.tsx in the product folders (vendored code, tests and fixtures excluded). */
export function productFiles(root: string = repoRoot(), tree: AuditTree = AUDIT_TREE): string[] {
  return tree.productFolders
    .flatMap((dir) => walkFiles(dir, root))
    .filter((file) => isProductFile(file, tree))
    .sort();
}

/** Every feature's copy module: each strings.ts in a copy folder. */
export function stringsModules(root: string = repoRoot(), tree: AuditTree = AUDIT_TREE): string[] {
  return productFiles(root, tree).filter(
    (file) => under(file, tree.copyFolders) && file.endsWith('/strings.ts'),
  );
}

/** A copy module Metro picks by platform: its iPhone default and its .android.ts / .ios.ts twin. */
const PLATFORM_COPY = /\/[a-z0-9-]+-copy(\.android|\.ios)?\.ts$/;

/**
 * Every module of copy: each strings.ts, then each platform copy module (step-up's check-copy.ts and
 * check-copy.android.ts), whose words a strings.ts builds its sentences from, so the audit reads them
 * where they are written.
 */
export function copyModules(root: string = repoRoot(), tree: AuditTree = AUDIT_TREE): string[] {
  const platform = productFiles(root, tree).filter(
    (file) => under(file, tree.copyFolders) && PLATFORM_COPY.test(file),
  );
  return [...stringsModules(root, tree), ...platform];
}

/** One file's text, by repo-relative path. */
export function readRepoFile(relPath: string, root: string = repoRoot()): string {
  return readFileSync(path.join(root, relPath), 'utf8');
}
