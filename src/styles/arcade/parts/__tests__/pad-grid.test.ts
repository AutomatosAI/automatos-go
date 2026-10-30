// The D-pad (pad-grid.ts; the kit's frame/controls.tsx; D-ARC-6): four named targets round the hub in a
// 3 × 3 grid of 64 pt cells that grow with Dynamic Type up to a third of the controls row (the words
// wrap past that: D-A11Y, OT-A5), the page on screen selected and Menu expanded while open, and the
// pad word in Pixelify Sans at 11 pt, where the longest word, 'Inventory', fits inside a cell's
// borders (measured from the bundled font).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ARCADE_COPY } from '../../../strings';
import { MIN_TEXT_SIZE } from '../../../type';
import { ARCADE_PAD_WORD, arcadePadWord } from '../../../typeface/arcade-type';
import {
  CONTROLS_PAD_H,
  DPAD_GRID,
  DPAD_IDS,
  DPAD_METRICS,
  padRowWidth,
  padSide,
  padState,
} from '../pad-grid';
import { advanceEm } from './ttf-advance';

const PIXELIFY = path.resolve(
  __dirname,
  '../../../../../assets/fonts/pixelify-sans/PixelifySans-Regular.ttf',
);
const DPAD_SOURCE = readFileSync(path.resolve(__dirname, '../DPad.tsx'), 'utf8');
const CONTROLS_SOURCE = readFileSync(
  path.resolve(__dirname, '../../home/ArcadeControls.tsx'),
  'utf8',
);

/** React Native's iOS font multipliers, xSmall to the largest Accessibility size (RCTFontUtils). */
const IOS_FONT_SCALES = [
  0.823, 0.882, 0.941, 1, 1.118, 1.235, 1.353, 1.786, 2.143, 2.643, 3.143, 3.571,
] as const;
/** 375 and 430 pt phones; their rows are these less the controls row’s padding each side. */
const PHONE_WIDTHS = [375, 430] as const;

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
    expect(padSide(1, 390)).toBe(64);
    expect(padSide(0.82, 390)).toBe(64);
    expect(padSide(1.5, 390)).toBe(96);
    expect(padSide(Number.NaN, 390)).toBe(64);
  });

  it('measures the row as the window less the controls row’s padding each side', () => {
    expect(CONTROLS_PAD_H).toBe(8);
    expect(PHONE_WIDTHS.map(padRowWidth)).toEqual([359, 414]);
  });

  it('keeps three cells inside the row at every iOS text size, each at least 64 pt (OT-A5)', () => {
    PHONE_WIDTHS.map(padRowWidth).forEach((width) => {
      IOS_FONT_SCALES.forEach((scale) => {
        const side = padSide(scale, width);
        expect(side * 3, `${scale} on ${width}`).toBeLessThanOrEqual(width);
        expect(side, `${scale} on ${width}`).toBeGreaterThanOrEqual(DPAD_METRICS.cell);
      });
    });
    expect(padSide(3.571, 359)).toBe(119);
    expect(padSide(3.571, 414)).toBe(138);
  });

  it('grows uncapped only when the row has no usable width, never under 64', () => {
    expect(padSide(1.5, Number.NaN)).toBe(96);
    expect(padSide(2, 120)).toBe(64);
  });
});

describe('the cells at large text (D-A11Y)', () => {
  it('lets the pad word wrap: no line cap on any text in the D-pad', () => {
    expect(DPAD_SOURCE).not.toMatch(/numberOfLines/);
  });

  it('holds a cell’s width to its side and lets a wrapped word make it taller', () => {
    expect(DPAD_SOURCE).toMatch(/\{ width: side, minHeight: side, borderColor: vars\.bd \}/);
    expect(DPAD_SOURCE).not.toMatch(/\bheight: side/);
  });

  it('sizes the cells from the window’s width less the row’s padding, one constant for both', () => {
    expect(DPAD_SOURCE).toMatch(/padSide\(fontScale, padRowWidth\(width\)\)/);
    expect(CONTROLS_SOURCE).toMatch(/padH: CONTROLS_PAD_H/);
    expect(CONTROLS_SOURCE).toMatch(/paddingHorizontal: CONTROLS\.padH/);
  });

  it('keeps the voice surround wrapping under the D-pad', () => {
    expect(CONTROLS_SOURCE).toMatch(/flexWrap: 'wrap'/);
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
