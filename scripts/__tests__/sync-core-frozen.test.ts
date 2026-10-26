import { describe, expect, it } from 'vitest';

import { FROZEN_DIR, frozenHeader, frozenProblems } from '../sync-core/frozen';
import { manifestSchema, sha256 } from '../sync-core/manifest';
import { REASON, SHA, manifest } from './sync-core-helpers';

const OLD = 'f'.repeat(40);
const SOURCE = { source: 'AutomatosAI/automatos-ai', root: 'frontend' };
const PATH = 'lib/mascot/reducer.ts';
const FILE = `${FROZEN_DIR}/${PATH}`;
const header = (path = PATH, sha = OLD) => frozenHeader(SOURCE, sha, path);
const TEXT = `${header()} — do not edit — scripts/core-manifest.json frozen\nexport const a = 1\n`;

const freezing = (files: Record<string, string>) =>
  manifest({ frozen: { sha: OLD, reason: REASON, files } });
const pinned = freezing({ [PATH]: sha256(TEXT) });
const onDisk = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe('sync-core --check: frozen copies', () => {
  it('names the source path and the frozen SHA in the header', () => {
    expect(header()).toBe(`// Frozen from AutomatosAI/automatos-ai frontend/${PATH} @ ${OLD}`);
  });

  it('passes when each copy opens with its header and matches its sha256', () => {
    const typeOnly = `${header('lib/t.ts')} · typeOnly: T — do not edit\nexport type T = 1\n`;
    const both = freezing({ [PATH]: sha256(TEXT), 'lib/t.ts': sha256(typeOnly) });
    const files = onDisk({ [FILE]: TEXT, [`${FROZEN_DIR}/lib/t.ts`]: typeOnly });
    expect(frozenProblems(both, files)).toEqual([]);
  });

  it('ignores files outside src/core/frozen (src/core/web is the lock check)', () => {
    const files = onDisk({ [FILE]: TEXT, 'src/core/web/lib/a.ts': 'export const a = 1\n' });
    expect(frozenProblems(pinned, files)).toEqual([]);
  });

  it('catches an edit, a missing copy and a stray file', () => {
    const edited = frozenProblems(pinned, onDisk({ [FILE]: TEXT.replace('= 1', '= 2') }));
    expect(edited).toEqual([
      `edited: ${FILE} (never edit a frozen copy: to change it, make it the app's own code)`,
    ]);
    expect(frozenProblems(pinned, onDisk({}))).toEqual([`missing: ${FILE}`]);
    const stray = `${FROZEN_DIR}/lib/stray.ts`;
    expect(frozenProblems(pinned, onDisk({ [FILE]: TEXT, [stray]: 'x\n' }))).toEqual([
      `extra: ${stray} (not listed under frozen in scripts/core-manifest.json)`,
    ]);
  });

  it.each([
    ['another SHA', `${header(PATH, SHA)}\nexport const a = 1\n`],
    ['another path', `${header('lib/mascot/reducer.tsx')}\nexport const a = 1\n`],
    ['no header', 'export const a = 1\n'],
  ])('catches a header naming %s, even when the recorded sha256 matches', (_, text) => {
    const problems = frozenProblems(freezing({ [PATH]: sha256(text) }), onDisk({ [FILE]: text }));
    expect(problems).toEqual([`${FILE} must open with the header: ${header()}`]);
  });

  it('treats every file under src/core/frozen as stray when the manifest freezes nothing', () => {
    expect(frozenProblems(manifest(), onDisk({ [FILE]: TEXT }))).toEqual([
      `extra: ${FILE} (not listed under frozen in scripts/core-manifest.json)`,
    ]);
  });

  it('refuses a frozen entry without a full SHA or a sha256 per file', () => {
    const base = { ...manifest(), frozen: { sha: OLD, reason: REASON, files: { [PATH]: 'abc' } } };
    expect(manifestSchema.safeParse(base).success).toBe(false);
    const short = { ...base, frozen: { ...base.frozen, sha: 'f00', files: {} } };
    expect(manifestSchema.safeParse(short).success).toBe(false);
  });
});
