import { describe, expect, it } from 'vitest';

import { buildLock } from '../sync-core/manifest';
import { REASON, SHA, manifest, output, runTests, vendoredPaths } from './sync-core-helpers';

const MODULE = 'export const double = (n: number) => n * 2\n';
const PASSING_TEST = [
  "import { describe, expect, it, vi } from 'vitest'",
  "import { double } from '@/lib/a'",
  "import { fixture } from './fixtures/numbers'",
  "vi.mock('@/lib/a', async () => vi.importActual('@/lib/a'))",
  "describe('double', () => { it('doubles', () => expect(double(fixture)).toBe(4)) })",
].join('\n');
const FIXTURE = "import { double } from '@/lib/a'\nexport const fixture = double(1)\n";

describe('sync-core: the web tests of vendored modules', () => {
  it('copies a test that needs only vitest, vendored modules and its fixtures', () => {
    const result = runTests({
      'lib/a.ts': MODULE,
      'lib/__tests__/a.test.ts': PASSING_TEST,
      'lib/__tests__/fixtures/numbers.ts': FIXTURE,
    });
    expect(result.problems).toEqual([]);
    expect(result.skipped).toEqual({});
    expect(vendoredPaths(result)).toEqual([
      'src/core/web/lib/__tests__/a.test.ts',
      'src/core/web/lib/__tests__/fixtures/numbers.ts',
    ]);
    const text = output(result, 'lib/__tests__/a.test.ts');
    expect(text.split('\n')[0]).toBe(
      `// Vendored from AutomatosAI/automatos-ai frontend/lib/__tests__/a.test.ts @ ${SHA} — do not edit — scripts/sync-core.ts`,
    );
    expect(text).toContain("import { double } from '../a'");
    expect(text).toContain("vi.mock('../a', async () => vi.importActual('../a'))");
    expect(output(result, 'lib/__tests__/fixtures/numbers.ts')).toContain("from '../../a'");
  });

  it('ignores a test beside a vendored module that imports no vendored module', () => {
    const result = runTests({
      'lib/a.ts': MODULE,
      'lib/__tests__/other.test.ts': "import { it } from 'vitest'\nimport { b } from '../b'\n",
      'lib/b.ts': 'export const b = 1\n',
    });
    expect(result.files).toEqual([]);
    expect(result.skipped).toEqual({});
  });

  it('accepts a node environment docblock and refuses any other', () => {
    const withEnv = (env: string) =>
      runTests({
        'lib/a.ts': MODULE,
        'lib/__tests__/a.test.ts': `/** @vitest-environment ${env} */\n${PASSING_TEST}`,
        'lib/__tests__/fixtures/numbers.ts': FIXTURE,
      }).skipped;
    expect(withEnv('node')).toEqual({});
    expect(withEnv('jsdom')).toEqual({
      'frontend/lib/__tests__/a.test.ts': 'runs in the jsdom environment',
    });
  });
});

describe('sync-core: why a web test is skipped', () => {
  const skippedFor = (test: string, extra: Record<string, string> = {}, overrides = {}) =>
    runTests({ 'lib/a.ts': MODULE, 'lib/__tests__/a.test.ts': test, ...extra }, overrides).skipped[
      'frontend/lib/__tests__/a.test.ts'
    ];
  const header = "import { it } from 'vitest'\nimport { double } from '../a'\n";

  it('names a package, a module that is not vendored and a name the narrowed copy lacks', () => {
    const reason = skippedFor(
      `${header}import { readFileSync } from 'node:fs'\nimport { b } from '../b'\n` +
        "import type { U } from '../t'\n",
      {
        'lib/b.ts': 'export const b = 1\n',
        'lib/t.ts': 'export type T = 1\nexport type U = 2\n',
        'lib/c.ts': "import type { T } from './t'\nexport type C = T\n",
      },
      {
        sets: { chat: ['lib/a.ts', 'lib/c.ts'] },
        typeOnly: { 'lib/t.ts': { names: ['T'], reason: REASON } },
      },
    );
    expect(reason).toContain("imports the package 'node:fs'");
    expect(reason).toContain("imports '../b' (lib/b.ts), which is not vendored");
    expect(reason).toContain('takes U from lib/t.ts, which is vendored typeOnly: T');
  });

  it('names a DOM global, unimported vitest globals and the fixture a reason comes from', () => {
    const reason = skippedFor(
      `${header}import { helper } from './helpers'\ndescribe('x', () => it('y', () => document.title))\n`,
      { 'lib/__tests__/helpers.ts': 'export const helper = () => window.innerWidth\n' },
    );
    expect(reason).toContain('refers to document (line 4)');
    expect(reason).toContain("uses vitest's globals without importing them: describe (line 4)");
    expect(reason).toContain('its fixture lib/__tests__/helpers.ts refers to window (line 1)');
  });

  it('spells out the first four distinct reasons and counts the rest', () => {
    const imports = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((p) => `import '${p}'`).join('\n');
    const reason = skippedFor(`${header}${imports}\n`) ?? '';
    expect(reason.split('; ')).toHaveLength(5);
    expect(reason).toMatch(/; and 2 more$/);
  });
});

describe('sync-core: skipTests and the lock', () => {
  const files = {
    'lib/a.ts': MODULE,
    'lib/__tests__/a.test.ts': PASSING_TEST,
    'lib/__tests__/fixtures/numbers.ts': FIXTURE,
    'lib/__tests__/b.test.ts':
      "import { it } from 'vitest'\nimport { double } from '../a'\nimport 'fs'\n",
  };

  it('skips by hand, with the manifest reason, a test the rule would copy', () => {
    const result = runTests(files, {
      skipTests: { 'lib/__tests__/a.test.ts': 'needs a font file the app does not ship' },
    });
    expect(result.problems).toEqual([]);
    expect(result.files).toEqual([]);
    expect(result.skipped['frontend/lib/__tests__/a.test.ts']).toBe(
      'needs a font file the app does not ship',
    );
  });

  it('reports a skipTests entry that is skipped anyway or is not a web test of a vendored module', () => {
    const result = runTests(files, {
      skipTests: { 'lib/__tests__/b.test.ts': REASON, 'lib/__tests__/gone.test.ts': REASON },
    });
    expect(result.problems).toEqual([
      "manifest skipTests entry lib/__tests__/b.test.ts is skipped anyway (imports the package 'fs'): remove it",
      'manifest skipTests entry lib/__tests__/gone.test.ts is not a web test of a vendored module: remove it',
    ]);
  });

  it('writes skippedTests into core.lock.json, sorted by path', () => {
    const lock = buildLock(manifest(), [], '2026-10-21T00:00:00.000Z', {
      'frontend/z.test.ts': 'z',
      'frontend/a.test.ts': 'a',
    });
    expect(Object.entries(lock.skippedTests)).toEqual([
      ['frontend/a.test.ts', 'a'],
      ['frontend/z.test.ts', 'z'],
    ]);
  });
});
