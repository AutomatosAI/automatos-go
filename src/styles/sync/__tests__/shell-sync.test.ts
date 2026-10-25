// StyleSync once for the app (US-016j): the slot draws the StyleSync the root layout hands it and
// nothing without one (rendered with react-dom's server renderer, as the connect kit's shell test
// does), and the wiring, read from the layouts' source: the root layout puts StyleSync in the slot
// around the screens, the signed-in layout renders the slot inside the gate beside its screens and
// imports nothing native for it, and A5's own screens keep their StyleSync for the guard to quiet.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import * as React from 'react';
import { createElement, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ShellStyleSync, StyleSyncSlot } from '../ShellStyleSync';

// vitest compiles the .tsx with the classic JSX runtime, which reads a global React
vi.stubGlobal('React', React);

// react-dom ships no types here (@types/react-dom is not a dependency): typed at the one call used
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  readonly renderToStaticMarkup: (element: ReactElement) => string;
};

const ROOT = path.resolve(__dirname, '../../../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

const Marker = () => 'style-sync';

describe('the shell slot', () => {
  it('draws the StyleSync handed to it, once', () => {
    const markup = renderToStaticMarkup(
      createElement(StyleSyncSlot, { sync: Marker }, createElement(ShellStyleSync)),
    );
    expect(markup).toBe('style-sync');
  });

  it('draws nothing with no slot above it', () => {
    expect(renderToStaticMarkup(createElement(ShellStyleSync))).toBe('');
  });

  it('loads nothing native: React is its one import', () => {
    const source = read('src/styles/sync/ShellStyleSync.tsx');
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
    expect(imports).toEqual(['react']);
  });
});

describe('the wiring (read from the source)', () => {
  it('the root layout hands StyleSync to the slot around the screens', () => {
    const root = read('app/_layout.tsx');
    expect(root).toContain("import { StyleSync } from '../src/styles/sync/StyleSync';");
    const opens = root.indexOf('<StyleSyncSlot sync={StyleSync}>');
    expect(opens).toBeGreaterThan(root.indexOf('<AuthRoot>'));
    expect(root.indexOf('<Stack')).toBeGreaterThan(opens);
    expect(root.indexOf('</StyleSyncSlot>')).toBeGreaterThan(root.indexOf('<Stack'));
  });

  it('the signed-in layout mounts it once, inside the gate, beside the screens', () => {
    const layout = read('app/(app)/_layout.tsx');
    expect(layout.split('<ShellStyleSync />')).toHaveLength(2);
    const sync = layout.indexOf('<ShellStyleSync />');
    expect(sync).toBeGreaterThan(layout.indexOf('<AppGate consent={<ConsentSheet />}'));
    expect(sync).toBeLessThan(layout.indexOf('<Stack'));
    expect(layout).toContain("from '../../src/styles/sync/ShellStyleSync';");
    expect(layout).not.toContain("from '../../src/styles/sync/StyleSync';");
  });

  it("A5's own screens keep their StyleSync, quieted by the guard under the shell's", () => {
    for (const screen of ['style.tsx', 'look/play.tsx', 'look/hud.tsx']) {
      expect(read(`app/(app)/settings/${screen}`)).toContain('<StyleSync />');
    }
    expect(read('src/styles/sync/StyleSync.tsx')).toContain('STYLE_SYNC_READER.join(id)');
  });
});
