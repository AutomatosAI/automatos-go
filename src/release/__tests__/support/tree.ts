// The product tree the release audits read (KR4): every .ts and .tsx file the app ships, from the
// repository itself, never from a module import. Test-only (node:fs and node:path): it lives under
// __tests__/ so no screen can import it and it never reaches the bundle.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const PACKAGE_NAME = 'automatos-go';
const PRODUCT_DIRS = ['src', 'app'] as const;
const SOURCE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const VENDORED_WEB = 'src/core/web/';
const TEST_DIRS = ['__tests__', '__fixtures__'];

/** The repository root: the nearest folder at or above process.cwd() with a package.json. */
export function repoRoot(): string {
  return findRoot(process.cwd(), process.cwd());
}

function findRoot(dir: string, start: string): string {
  const name = packageName(dir);
  if (name !== undefined) {
    if (name !== PACKAGE_NAME) {
      throw new Error(`${dir}/package.json is '${name}', not ${PACKAGE_NAME}: run from the repo`);
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
export function walkFiles(relDir: string): string[] {
  const root = repoRoot();
  const walk = (rel: string): string[] =>
    readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap((entry) => {
      const child = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) return walk(child);
      return entry.isFile() ? [child] : [];
    });
  return walk(relDir).sort();
}

/** True for a .ts/.tsx file the app ships: under src/ or app/, not vendored web code, not a test. */
export function isProductFile(relPath: string): boolean {
  if (!PRODUCT_DIRS.some((dir) => relPath.startsWith(`${dir}/`))) return false;
  if (!SOURCE.test(relPath) || TEST_FILE.test(relPath)) return false;
  if (relPath.startsWith(VENDORED_WEB)) return false;
  const folders = relPath.split('/').slice(0, -1);
  return !folders.some((folder) => TEST_DIRS.includes(folder));
}

/** Every product .ts/.tsx under src/ and app/ (src/core/web, tests and fixtures excluded). */
export function productFiles(): string[] {
  return PRODUCT_DIRS.flatMap((dir) => walkFiles(dir))
    .filter(isProductFile)
    .sort();
}

/** Every feature's copy module: each strings.ts under src/. */
export function stringsModules(): string[] {
  return productFiles().filter((file) => file.startsWith('src/') && file.endsWith('/strings.ts'));
}

/** One file's text, by repo-relative path. */
export function readRepoFile(relPath: string): string {
  return readFileSync(path.join(repoRoot(), relPath), 'utf8');
}
