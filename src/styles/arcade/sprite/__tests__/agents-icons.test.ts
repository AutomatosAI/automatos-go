// The party's robots and the item icons against the design kit (D-ARC-6, KA3-VENDOR-PIN): every
// robot and icon is the kit's, pixel for pixel. The fingerprints are the sha256 (first 16 hex) of
// each picture's runs as the kit's own code at 034fa629c draws them
// (themes/arcade/src/art/{grid,agents-icons}.ts, run through esbuild in Node on 30 Oct 2026), by
// kit-frames.ts's digest. Also: the provenance header, the keys and sizes, and the pure imports.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { AGENT_COLOURS, ICON_KEYS } from '../../../tokens/arcade-catalogue';
import {
  AGENT_ART,
  AGENT_LOOKS,
  AGENT_SIZE,
  ICON_ART,
  ICON_SIZE,
  type ItemKind,
} from '../agents-icons';
import type { Run } from '../grid';
import { AGENT_KEYS } from '../paint';

const KIT_AGENTS = ['7493d2e5d072eb1d', '25df19f99b95cb49', 'c03f6d5ca9f9e70e', '9b58d07cce813fe8'];
const KIT_ICONS: Readonly<Record<ItemKind, string>> = {
  report: 'd768fddb9c1e797d',
  document: '4d0a995845f556d0',
  image: 'f1712c426ca2ce99',
  post: 'f2809ffb039e8fe9',
};
const SOURCE_SHA = '440ee4dcfc67abdbb0749da1c4614820c452e4748ab57b53f089584b6c07ff05';

function digest(runs: readonly Run<string>[]): string {
  const text = runs.map((run) => `${run.x},${run.y},${run.width},${run.key}`).join(';');
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function inside(runs: readonly Run<string>[], size: number, keys: ReadonlySet<string>): void {
  runs.forEach((run) => {
    expect(keys.has(run.key)).toBe(true);
    expect(run.x).toBeGreaterThanOrEqual(0);
    expect(run.x + run.width).toBeLessThanOrEqual(size);
    expect(run.y).toBeGreaterThanOrEqual(0);
    expect(run.y).toBeLessThan(size);
  });
}

describe('the party’s robots', () => {
  it('are the kit’s four, pixel for pixel', () => {
    expect(AGENT_ART.map(digest)).toEqual(KIT_AGENTS);
  });

  it('are as many as the catalogue has robot colours, 16 pixels square, in the robot keys', () => {
    expect(AGENT_ART).toHaveLength(AGENT_LOOKS);
    expect(AGENT_COLOURS.bronze).toHaveLength(AGENT_LOOKS);
    expect(AGENT_COLOURS.shades).toHaveLength(AGENT_LOOKS);
    AGENT_ART.forEach((runs) => inside(runs, AGENT_SIZE, new Set<string>(AGENT_KEYS)));
  });

  it('differ by their antenna, each with a crest', () => {
    expect(new Set(AGENT_ART.map(digest)).size).toBe(AGENT_LOOKS);
    AGENT_ART.forEach((runs) => expect(runs.some((run) => run.key === 'crest')).toBe(true));
  });
});

describe('the item icons', () => {
  it.each(Object.keys(KIT_ICONS) as ItemKind[])('%s is the kit’s, pixel for pixel', (kind) => {
    expect(digest(ICON_ART[kind])).toBe(KIT_ICONS[kind]);
    inside(ICON_ART[kind], ICON_SIZE, new Set<string>(ICON_KEYS));
  });
});

describe('agents-icons.ts', () => {
  const source = readFileSync(path.resolve(__dirname, '..', 'agents-icons.ts'), 'utf8');

  it('names its kit path, commit and source sha256 (KA3-VENDOR-PIN)', () => {
    expect(source).toContain('themes/arcade/src/art/agents-icons.ts');
    expect(source).toContain('034fa629c8ba79cff042559ca2d132f6d38f6d23');
    expect(source).toContain(SOURCE_SHA);
  });

  it('imports no React, React Native, Expo or Skia, and takes no colour literal', () => {
    expect(source).not.toMatch(/from '(react|react-native[^']*|expo[^']*|@shopify\/[^']*)'/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{6}\b|rgba?\(/);
  });
});
