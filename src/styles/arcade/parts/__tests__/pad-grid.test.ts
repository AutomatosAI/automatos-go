// The D-pad (pad-grid.ts; the kit's frame/controls.tsx; D-ARC-6): four named targets round the hub in a
// 3 × 3 grid of 64 pt cells that grow with Dynamic Type, the page on screen selected and Menu
// expanded while open, and the pad word in Pixelify Sans at 11 pt, where the longest word,
// 'Inventory', fits inside a cell's borders (measured from the bundled font).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ARCADE_COPY } from '../../../strings';
import { MIN_TEXT_SIZE } from '../../../type';
import { ARCADE_PAD_WORD, arcadePadWord } from '../../../typeface/arcade-type';
import { DPAD_GRID, DPAD_IDS, DPAD_METRICS, padSide, padState } from '../pad-grid';
import { advanceEm } from './ttf-advance';

const PIXELIFY = path.resolve(
  __dirname,
  '../../../../../assets/fonts/pixelify-sans/PixelifySans-Regular.ttf',
);

describe('the grid (README Pages)', () => {
  it('puts ▲ Quests over the hub, ◀ Chat and ▶ Inventory beside it and ▼ Menu under it', () => {
    expect(DPAD_GRID).toEqual([
      [null, 'quests', null],
      ['chat', 'hub', 'inventory'],
      [null, 'menu', null],
    ]);
    expect(
      DPAD_IDS.map((id) => `${ARCADE_COPY.dpad[id].arrow} ${ARCADE_COPY.dpad[id].word}`),
    ).toEqual(['▲ Quests', '◀ Chat', '▶ Inventory', '▼ Menu']);
  });

  it('says where each target goes (D-ARC-6)', () => {
    expect(DPAD_IDS.map((id) => ARCADE_COPY.dpad[id].hint)).toEqual([
      'Shows your quests on the map',
      "Auto's chat",
      'Shows your Deliverables as items',
      'Opens the menu',
    ]);
  });

  it('makes each cell a 64 pt target that grows with the phone’s text size, never shrinks', () => {
    expect(DPAD_METRICS.cell).toBe(64);
    expect(padSide(1)).toBe(64);
    expect(padSide(0.82)).toBe(64);
    expect(padSide(1.5)).toBe(96);
    expect(padSide(Number.NaN)).toBe(64);
  });
});

describe('the selected target', () => {
  it('is the page on screen while the menu is closed', () => {
    expect(padState('chat', 'chat', false)).toEqual({ selected: true });
    expect(padState('quests', 'chat', false)).toEqual({ selected: false });
    expect(padState('menu', 'chat', false)).toEqual({ selected: false, expanded: false });
  });

  it('is Menu, expanded, while the menu is open', () => {
    expect(padState('menu', 'chat', true)).toEqual({ selected: true, expanded: true });
    expect(padState('chat', 'chat', true)).toEqual({ selected: false });
  });

  it('is none when the page is none of the four', () => {
    DPAD_IDS.filter((id) => id !== 'menu').forEach((id) => {
      expect(padState(id, null, false).selected).toBe(false);
    });
  });
});

describe('the pad word (D38)', () => {
  it('is Pixelify Sans at 11 pt, never under the floor', () => {
    const word = arcadePadWord();
    expect(ARCADE_PAD_WORD.size).toBe(MIN_TEXT_SIZE);
    expect(word.fontSize).toBeGreaterThanOrEqual(MIN_TEXT_SIZE);
    expect(word.fontFamily).toMatch(/Pixelify/);
  });

  it('fits every word inside a cell’s borders at that size; the design’s 13 does not fit Inventory', () => {
    const font = readFileSync(PIXELIFY);
    const inside = DPAD_METRICS.cell - DPAD_METRICS.ring * 2;
    DPAD_IDS.forEach((id) => {
      const width = advanceEm(font, ARCADE_COPY.dpad[id].word) * ARCADE_PAD_WORD.size;
      expect(width, ARCADE_COPY.dpad[id].word).toBeLessThanOrEqual(inside);
    });
    expect(advanceEm(font, 'Inventory') * 13).toBeGreaterThan(inside);
  });
});
