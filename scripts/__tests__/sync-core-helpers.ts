// Inline fixtures shared by the sync-core suites: a manifest at the pin, the web's aliases and
// an in-memory source tree.
import { vendor, type VendorResult } from '../sync-core/closure';
import { manifestSchema, type Manifest } from '../sync-core/manifest';
import { aliasesFromPaths, type SourceTree } from '../sync-core/resolve';
import { vendorTests, type TestsResult } from '../sync-core/tests';

export const SHA = '630fc1c85af06c5c76e70c74e9653ee1804fdf41';
export const REASON = 'a test entry';
export const ALIASES = aliasesFromPaths({
  '@/*': ['./*'],
  '@automatos/theme-sdk': ['./lib/theme-sdk/index.ts'],
});

export function manifest(overrides: Partial<Manifest> = {}): Manifest {
  return manifestSchema.parse({
    source: 'AutomatosAI/automatos-ai',
    sha: SHA,
    root: 'frontend',
    sets: { chat: ['lib/a.ts'] },
    extract: {},
    drop: {},
    typeOnly: {},
    shims: {},
    ...overrides,
  });
}

export function tree(files: Record<string, string>): SourceTree {
  const map = new Map(Object.entries(files));
  const list = (dir: string) =>
    [...map.keys()]
      .filter((path) => path.startsWith(`${dir}/`))
      .map((path) => path.slice(dir.length + 1))
      .filter((name) => !name.includes('/'));
  return { read: (path) => map.get(path), list };
}

function configOf(overrides: Partial<Manifest>) {
  return { manifest: manifest(overrides), aliases: ALIASES, packages: new Set(['zod']) };
}

export function run(
  files: Record<string, string>,
  overrides: Partial<Manifest> = {},
): VendorResult {
  return vendor(configOf(overrides), tree(files));
}

/** The module walk and then the test pass over what it vendored, as the CLI runs them. */
export function runTests(
  files: Record<string, string>,
  overrides: Partial<Manifest> = {},
): TestsResult {
  const config = configOf(overrides);
  const source = tree(files);
  return vendorTests(config, source, vendor(config, source).sources);
}

export function output(result: { readonly files: VendorResult['files'] }, path: string): string {
  const file = result.files.find((f) => f.path === `src/core/web/${path}`);
  if (!file) throw new Error(`${path} was not vendored`);
  return file.text;
}

export function vendoredPaths(result: { readonly files: VendorResult['files'] }): string[] {
  return result.files.map((f) => f.path).sort();
}
