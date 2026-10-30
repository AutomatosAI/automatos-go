// The overworld against the design kit (D-ARC-6, KA3-VENDOR-PIN): the tile map, its regions, every
// rect it draws and where markers land are the kit's, exactly. The fingerprints are the sha256
// (first 16 hex) of each as the kit's own world-map.ts at 034fa629c computes it (run through
// esbuild in Node on 30 Oct 2026), so the reshaped tileAt (landTile, for the lint's complexity 10)
// is proved unchanged. Also: the provenance header, the colour keys and the pure imports.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PALETTES } from '../../../tokens/arcade-catalogue';
import {
  MAP_COLUMNS,
  MAP_RECTS,
  MAP_ROWS,
  TILE,
  hashOf,
  placeMarkers,
  regionAt,
  riverAt,
  tileAt,
  type Region,
} from '../world-map';

const SOURCE_SHA = '86888cab963aef021db3cfa5189f361b19c454d729eed391291bdd6c8ca55681';

const KIT = Object.freeze({
  rectCount: 3518,
  rects: '03b9b9c0ee7c3574',
  tiles: 'b12e318d7870a526',
  regions: '123c0e4e95f87d05',
  placed: 'e7ce60fc101460d0',
});

const digest = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);

function everyTile<T>(read: (tx: number, ty: number) => T): string {
  return Array.from({ length: MAP_ROWS }, (_, ty) =>
    Array.from({ length: MAP_COLUMNS }, (_, tx) => String(read(tx, ty))).join(','),
  ).join('\n');
}

describe('the overworld (world-map.ts)', () => {
  it('is 40 × 24 tiles of 8 map pixels', () => {
    expect([MAP_COLUMNS, MAP_ROWS, TILE]).toEqual([40, 24, 8]);
  });

  it('has the kit’s tiles and regions on every tile', () => {
    expect(digest(everyTile(tileAt))).toBe(KIT.tiles);
    expect(digest(everyTile(regionAt))).toBe(KIT.regions);
  });

  it('draws the kit’s rects, in the kit’s order', () => {
    const text = MAP_RECTS.map((r) => `${r.x},${r.y},${r.width},${r.height},${r.key}`).join(';');
    expect(MAP_RECTS).toHaveLength(KIT.rectCount);
    expect(digest(text)).toBe(KIT.rects);
  });

  it('keeps every rect inside the map', () => {
    MAP_RECTS.forEach((rect) => {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(MAP_COLUMNS * TILE);
      expect(rect.y + rect.height).toBeLessThanOrEqual(MAP_ROWS * TILE);
    });
  });

  it('runs its river down the right third with one bridge, on row 12', () => {
    expect(Array.from({ length: MAP_ROWS }, (_, row) => riverAt(row))).toEqual([
      21, 21, 22, 22, 22, 22, 22, 22, 22, 21, 21, 20, 20, 20, 20, 20, 20, 20, 21, 21, 22, 22, 22,
      22,
    ]);
    const bridges = everyTile(tileAt)
      .split('\n')
      .map((row) => row.split(',').indexOf('bridge'));
    expect(bridges.flatMap((at, row) => (at === -1 ? [] : [row]))).toEqual([12]);
  });

  it('paints only keys the palettes colour', () => {
    const keys = new Set(MAP_RECTS.map((rect) => rect.key));
    PALETTES.forEach((palette) =>
      expect(Object.keys(palette.map).sort()).toEqual([...keys].sort()),
    );
  });
});

describe('placing markers', () => {
  const REGIONS: readonly Region[] = ['active', 'needs', 'done'];

  it('lands ids where the kit lands them', () => {
    const items = Array.from({ length: 90 }, (_, i) => ({
      id: String(1000 + i * 7),
      region: REGIONS[i % 3],
    }));
    const placed = placeMarkers(items);
    const text = [...placed.entries()].map(([id, s]) => `${id}:${s.tx},${s.ty}`).join(';');
    expect(placed.size).toBe(90);
    expect(digest(text)).toBe(KIT.placed);
    expect([
      ...placeMarkers([
        { id: '42', region: 'active' },
        { id: '7', region: 'needs' },
      ]),
    ]).toEqual([
      ['42', { tx: 18, ty: 15 }],
      ['7', { tx: 33, ty: 8 }],
    ]);
  });

  it('puts each on a grass tile of its own region, clear of the region names', () => {
    const items = REGIONS.flatMap((region) =>
      Array.from({ length: 12 }, (_, i) => ({ id: `${region}-${i}`, region })),
    );
    placeMarkers(items).forEach((spot, id) => {
      const region = items.find((item) => item.id === id)?.region;
      expect(regionAt(spot.tx, spot.ty)).toBe(region);
      expect(tileAt(spot.tx, spot.ty)).toBe('grass');
      const underName = spot.ty <= 2 || (spot.tx >= 23 && [14, 15].includes(spot.ty));
      expect(underName).toBe(false);
    });
  });

  it('lands the same id on the same tile every time, by the kit’s FNV-1a hash', () => {
    expect(['', '42', 'quest', '#0042', 'é'].map(hashOf)).toEqual([
      2166136261, 2279835011, 164679485, 3794257168, 1812687940,
    ]);
    const once = placeMarkers([{ id: '42', region: 'done' }]);
    expect(placeMarkers([{ id: '42', region: 'done' }])).toEqual(once);
  });
});

describe('world-map.ts', () => {
  const source = readFileSync(path.resolve(__dirname, '..', 'world-map.ts'), 'utf8');

  it('names its kit path, commit and source sha256 (KA3-VENDOR-PIN)', () => {
    expect(source).toContain('themes/arcade/src/art/world-map.ts');
    expect(source).toContain('034fa629c8ba79cff042559ca2d132f6d38f6d23');
    expect(source).toContain(SOURCE_SHA);
  });

  it.each(['world-map.ts', 'map-paint.ts'])(
    '%s imports no React, React Native, Expo or Skia and takes no colour literal',
    (file) => {
      const text = readFileSync(path.resolve(__dirname, '..', file), 'utf8');
      expect(text).not.toMatch(/from '(react|react-native[^']*|expo[^']*|@shopify\/[^']*)'/);
      expect(text).not.toMatch(/#[0-9a-fA-F]{6}\b|rgba?\(/);
    },
  );
});
