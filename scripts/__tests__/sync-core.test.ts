import { describe, expect, it } from 'vitest';

import { vendor, type VendorResult } from '../sync-core/closure';
import { buildLock, checkLock, manifestSchema, type Manifest } from '../sync-core/manifest';
import { aliasesFromPaths, type SourceTree } from '../sync-core/resolve';

const SHA = '630fc1c85af06c5c76e70c74e9653ee1804fdf41';
const REASON = 'a test entry';
const ALIASES = aliasesFromPaths({
  '@/*': ['./*'],
  '@automatos/theme-sdk': ['./lib/theme-sdk/index.ts'],
});

function manifest(overrides: Partial<Manifest> = {}): Manifest {
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

function tree(files: Record<string, string>): SourceTree {
  const map = new Map(Object.entries(files));
  return { read: (path) => map.get(path) };
}

function run(files: Record<string, string>, overrides: Partial<Manifest> = {}): VendorResult {
  const config = { manifest: manifest(overrides), aliases: ALIASES, packages: new Set(['zod']) };
  return vendor(config, tree(files));
}

function output(result: VendorResult, path: string): string {
  const file = result.files.find((f) => f.path === `src/core/web/${path}`);
  if (!file) throw new Error(`${path} was not vendored`);
  return file.text;
}

function vendoredPaths(result: VendorResult): string[] {
  return result.files.map((f) => f.path).sort();
}

describe('sync-core: copy, aliases and the closure', () => {
  it('rewrites @/ and @automatos/theme-sdk aliases to relative paths inside src/core/web', () => {
    const result = run(
      {
        'lib/a.ts': "import { b } from '@/lib/util/b'\nexport const a = b\n",
        'lib/util/b.ts':
          "import type { Look } from '@automatos/theme-sdk'\nexport const b: Look = 1\n",
        'lib/theme-sdk/index.ts': 'export type Look = number\n',
      },
      { sets: { chat: ['lib/a.ts'] } },
    );
    expect(result.problems).toEqual([]);
    expect(output(result, 'lib/a.ts')).toContain("import { b } from './util/b'");
    expect(output(result, 'lib/util/b.ts')).toContain("from '../theme-sdk/index'");
  });

  it('prefixes every file with one header line naming the source path, the SHA and the rule', () => {
    const result = run({ 'lib/a.ts': 'export const a = 1\n' });
    const [first, second] = output(result, 'lib/a.ts').split('\n');
    expect(first).toBe(
      `// Vendored from AutomatosAI/automatos-ai frontend/lib/a.ts @ ${SHA} — do not edit — scripts/sync-core.ts`,
    );
    expect(second).toBe('export const a = 1');
  });

  it('follows relative and aliased imports transitively and vendors nothing else', () => {
    const result = run({
      'lib/a.ts': "import { b } from './b'\nexport const a = b\n",
      'lib/b.ts': "import { c } from '@/types/c'\nexport const b = c\n",
      'types/c.ts': 'export const c = 1\n',
      'lib/unrelated.ts': 'export const d = 1\n',
    });
    expect(result.problems).toEqual([]);
    expect(vendoredPaths(result)).toEqual([
      'src/core/web/lib/a.ts',
      'src/core/web/lib/b.ts',
      'src/core/web/types/c.ts',
    ]);
  });
});

describe('sync-core: purity, on the AST', () => {
  it('rejects a react import and prints the import chain that reached it', () => {
    const result = run({
      'lib/a.ts': "import { useB } from './b'\nexport const a = useB\n",
      'lib/b.ts': "import { useState } from 'react'\nexport const useB = useState\n",
    });
    const [problem] = result.problems;
    expect(problem).toContain("lib/b.ts is impure: it imports 'react'");
    expect(problem).toContain('import chain: lib/a.ts → lib/b.ts');
  });

  it('rejects a reference to window', () => {
    const result = run({ 'lib/a.ts': 'export const width = () => window.innerWidth\n' });
    expect(result.problems.join('\n')).toContain(
      'lib/a.ts is impure: it refers to window (line 1)',
    );
  });

  it('rejects globalThis.fetch and typeof document', () => {
    const result = run({
      'lib/a.ts':
        "export const f = globalThis.fetch\nexport const ssr = typeof document === 'undefined'\n",
    });
    expect(result.problems.join('\n')).toContain('fetch (line 1), document (line 2)');
  });

  it('does NOT reject the word window in a comment or a string, a member or a local binding', () => {
    const result = run({
      'lib/a.ts': [
        '// the window of time before a retry; never touches document or fetch',
        "export const label = 'open in a new window'",
        'export const width = (frame: { window: number }) => frame.window',
        'export function title(document: { title: string }) { return document.title }',
        'export const opts = { fetch: false, localStorage: 0 }',
      ].join('\n'),
    });
    expect(result.problems).toEqual([]);
  });
});

const IMPURE_TYPES = [
  "import { useState } from 'react'",
  "import type { Dep } from './dep'",
  '/** Kept, with what it references. */',
  'export interface Wanted { inner: Inner; dep: Dep }',
  'interface Inner { n: number }',
  'export interface Unrelated { x: string }',
  'export function useThing() { return useState(window.location) }',
].join('\n');

describe('sync-core: typeOnly', () => {
  const typeOnly = { 'lib/impure.ts': { names: ['Wanted'], reason: REASON } };

  it('typeOnly extracts the named type and its local type dependencies, nothing impure', () => {
    const result = run(
      {
        'lib/a.ts':
          "import type { Wanted } from './impure'\nexport const n = (w: Wanted) => w.inner.n\n",
        'lib/impure.ts': IMPURE_TYPES,
        'lib/dep.ts': 'export type Dep = string\n',
      },
      { typeOnly },
    );
    expect(result.problems).toEqual([]);
    const text = output(result, 'lib/impure.ts');
    expect(text).toContain('typeOnly: Wanted');
    expect(text).toContain('/** Kept, with what it references. */');
    expect(text).toContain('export interface Wanted { inner: Inner; dep: Dep }');
    expect(text).toContain('interface Inner { n: number }');
    expect(text).toContain("import type { Dep } from './dep'");
    expect(text).not.toMatch(/Unrelated|useThing|react|window/);
    expect(vendoredPaths(result)).toContain('src/core/web/lib/dep.ts');
  });

  it('typeOnly refuses a value import and a name the manifest does not list', () => {
    const importing = (line: string) =>
      run(
        {
          'lib/a.ts': `${line}\nexport type T = Wanted | Unrelated\n`,
          'lib/impure.ts': IMPURE_TYPES,
          'lib/dep.ts': 'export type Dep = string\n',
        },
        { typeOnly },
      ).problems.join('\n');
    expect(importing("import { Wanted, Unrelated } from './impure'")).toContain(
      'is a value import of lib/impure.ts',
    );
    expect(importing("import type { Wanted, Unrelated } from './impure'")).toContain(
      'lib/impure.ts is typeOnly: add Unrelated to its names in the manifest',
    );
  });
});

describe('sync-core: typeOnly through a barrel', () => {
  it('typeOnly narrows a barrel through export * to the module that declares the name', () => {
    const result = run(
      {
        'lib/a.ts': "import type { HostX } from '@automatos/theme-sdk'\nexport type A = HostX\n",
        'lib/theme-sdk/index.ts': "export * from './chat'\nexport * from './nav'\n",
        'lib/theme-sdk/chat.ts': 'export interface HostX { id: string }\n',
        'lib/theme-sdk/nav.tsx': "import Link from 'next/link'\nexport const Nav = Link\n",
      },
      { typeOnly: { 'lib/theme-sdk/index.ts': { names: ['HostX'], reason: REASON } } },
    );
    expect(result.problems).toEqual([]);
    expect(output(result, 'lib/theme-sdk/index.ts')).toContain(
      "export type { HostX } from './chat'",
    );
    expect(vendoredPaths(result)).not.toContain('src/core/web/lib/theme-sdk/nav.tsx');
  });
});

describe('sync-core: extract', () => {
  it('extract keeps one named function with its local helpers and types, not the hook', () => {
    const result = run(
      {
        'lib/a.ts':
          "import { parseFrames } from '@/hooks/use-stream'\nexport const p = parseFrames\n",
        'hooks/use-stream.ts': [
          "import { useEffect } from 'react'",
          'export interface Frame { event: string }',
          'export function parseFrames(text: string): Frame[] { return split(text).map((event) => ({ event })) }',
          "function split(text: string) { return text.split('\\n\\n') }",
          'export function useStream() { useEffect(() => undefined, []) }',
        ].join('\n'),
      },
      { extract: { 'hooks/use-stream.ts': { names: ['parseFrames'], reason: REASON } } },
    );
    expect(result.problems).toEqual([]);
    const text = output(result, 'hooks/use-stream.ts');
    expect(text).toContain('export function parseFrames');
    expect(text).toContain('function split');
    expect(text).toContain('export interface Frame');
    expect(text).not.toMatch(/useStream|useEffect|react/);
  });
});

describe('sync-core: drop', () => {
  it('drop removes one named function and the import only it used', () => {
    const result = run(
      {
        'lib/a.ts': [
          "import { readStore } from './store'",
          "export const KEY = 'k'",
          'export function load() { return readStore(window.localStorage, KEY) }',
          'export function tabs() { return [KEY] }',
        ].join('\n'),
        'lib/store.ts': 'export const readStore = (s: unknown, k: string) => [s, k]\n',
      },
      { drop: { 'lib/a.ts': { names: ['load'], reason: REASON } } },
    );
    expect(result.problems).toEqual([]);
    const text = output(result, 'lib/a.ts');
    expect(text).toContain('drop: load');
    expect(text).toContain('export function tabs()');
    expect(text).not.toMatch(/function load|readStore|window/);
    expect(vendoredPaths(result)).toEqual(['src/core/web/lib/a.ts']);
  });

  it('drop refuses to remove a declaration the kept code still uses', () => {
    const result = run(
      { 'lib/a.ts': 'export const KEY = window.name\nexport const tabs = () => [KEY]\n' },
      { drop: { 'lib/a.ts': { names: ['KEY'], reason: REASON } } },
    );
    expect(result.problems.join('\n')).toContain('KEY is dropped but still used by tabs');
  });
});

describe('sync-core: shims and packages', () => {
  const shims = { '@ai-sdk/react': { path: 'src/core/shims/ai-sdk-react.ts', reason: REASON } };

  it('redirects a type-only package import to its hand-written shim in src/core/shims', () => {
    const result = run(
      {
        'lib/a.ts':
          "import type { ChatMessage } from '@/types/chat'\nexport type A = ChatMessage\n",
        'types/chat.ts':
          "import type { UIMessage } from '@ai-sdk/react'\nexport type ChatMessage = UIMessage & { parts: string[] }\n",
      },
      { shims },
    );
    expect(result.problems).toEqual([]);
    expect(output(result, 'types/chat.ts')).toContain(
      "import type { UIMessage } from '../../shims/ai-sdk-react'",
    );
  });

  it('refuses a value import from a shimmed package and an import the app does not depend on', () => {
    const result = run(
      {
        'lib/a.ts':
          "import { useChat } from '@ai-sdk/react'\nimport { toast } from 'sonner'\nimport { z } from 'zod'\nexport const a = [useChat, toast, z]\n",
      },
      { shims },
    );
    const problems = result.problems.join('\n');
    expect(problems).toContain("only types may come from shimmed '@ai-sdk/react'");
    expect(problems).toContain("imports 'sonner', which the app does not depend on");
    expect(problems).not.toContain('zod');
  });

  it('reports a manifest entry the walk never reaches', () => {
    const result = run(
      { 'lib/a.ts': 'export const a = 1\n' },
      { typeOnly: { 'lib/gone.ts': { names: ['X'], reason: REASON } } },
    );
    expect(result.problems).toEqual([
      'manifest typeOnly entry lib/gone.ts is never reached: remove it',
    ]);
  });
});

describe('sync-core --check', () => {
  const pinned = manifest();
  const written = [
    { path: 'src/core/web/lib/a.ts', text: 'export const a = 1\n' },
    { path: 'src/core/web/lib/b.ts', text: 'export const b = 2\n' },
  ];
  const lock = buildLock(pinned, written, '2026-10-21T00:00:00.000Z');
  const onDisk = (changes: Record<string, string | null> = {}) => {
    const files = new Map(written.map((f) => [f.path, f.text]));
    for (const [path, text] of Object.entries(changes)) {
      if (text === null) files.delete(path);
      else files.set(path, text);
    }
    return files;
  };

  it('passes when src/core/web matches the lock', () => {
    expect(checkLock(pinned, lock, onDisk())).toEqual([]);
  });

  it('catches a one-byte edit', () => {
    const problems = checkLock(
      pinned,
      lock,
      onDisk({ 'src/core/web/lib/a.ts': 'export const a = 2\n' }),
    );
    expect(problems).toEqual(['edited: src/core/web/lib/a.ts (never edit vendored files)']);
  });

  it('catches an extra file and a missing file', () => {
    const problems = checkLock(
      pinned,
      lock,
      onDisk({ 'src/core/web/lib/extra.ts': 'x', 'src/core/web/lib/b.ts': null }),
    );
    expect(problems).toEqual([
      'missing: src/core/web/lib/b.ts',
      'extra: src/core/web/lib/extra.ts (not written by scripts/sync-core.ts)',
    ]);
  });

  it('catches a lock pinned to another SHA and a set entry that was never synced', () => {
    const moved = manifest({ sha: 'b'.repeat(40), sets: { chat: ['lib/a.ts', 'lib/new.ts'] } });
    const problems = checkLock(moved, lock, onDisk());
    expect(problems[0]).toContain(`core.lock.json is pinned to AutomatosAI/automatos-ai@${SHA}`);
    expect(problems[1]).toContain('not vendored: lib/new.ts');
  });
});
