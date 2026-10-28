// HUD's button row with the EN/PT switch, by width (language-layout.ts): on a 375 pt phone the row's
// least width fits with 8 pt between its groups; the switch is always 44 pt to touch, and its slop
// never reaches HOLD TO TALK; from 390 pt up the row is #25's (a 44 pt square, no slop).

import { describe, expect, it } from 'vitest';

import { MIN_TOUCH } from '../../../../ui/paint';
import {
  COMPACT_BELOW,
  GROUP_GAP,
  centreMinWidth,
  hudLanguageLayout,
  rowMinWidth,
} from '../language-layout';
import { HUD_CORE } from '../model';

const NARROW = 375;
const { buttons } = HUD_CORE;

describe('the row on a narrow phone', () => {
  it('fits 375 pt with 8 pt between the groups', () => {
    expect(GROUP_GAP).toBe(8);
    const layout = hudLanguageLayout(NARROW);
    const groups = buttons.side.width * 2 + centreMinWidth(layout);
    expect(buttons.padX * 2 + groups + GROUP_GAP * 2).toBeLessThanOrEqual(NARROW);
    expect(rowMinWidth(layout)).toBeLessThanOrEqual(NARROW);
  });

  it('keeps room over the 8 pt for larger Dynamic Type', () => {
    expect(NARROW - rowMinWidth(hudLanguageLayout(NARROW))).toBeGreaterThanOrEqual(20);
  });

  it('would not fit with the full 44 pt switch (why it is compact)', () => {
    expect(rowMinWidth(hudLanguageLayout(COMPACT_BELOW))).toBeGreaterThan(NARROW);
  });

  it('keeps the circle centred: the twin room is as wide as the switch', () => {
    const layout = hudLanguageLayout(NARROW);
    expect(centreMinWidth(layout)).toBe(layout.size * 2 + layout.gap * 2 + buttons.talk.size);
  });
});

describe('the switch’s touch target', () => {
  for (const width of [320, NARROW, COMPACT_BELOW, 430]) {
    it(`is 44 pt at ${width} pt, its slop no wider than the gap to the circle`, () => {
      const layout = hudLanguageLayout(width);
      expect(layout.size + layout.slop * 2).toBeGreaterThanOrEqual(MIN_TOUCH);
      expect(layout.slop).toBeLessThanOrEqual(layout.gap);
    });
  }
});

describe('the row from 390 pt up', () => {
  it('is #25’s: a 44 pt square, 6 pt from the circle, no slop', () => {
    for (const width of [COMPACT_BELOW, 393, 402, 430])
      expect(hudLanguageLayout(width)).toEqual({ size: 44, gap: 6, slop: 0 });
    expect(COMPACT_BELOW).toBe(390);
  });

  it('fits with 8 pt between the groups', () => {
    expect(rowMinWidth(hudLanguageLayout(COMPACT_BELOW))).toBeLessThanOrEqual(COMPACT_BELOW);
  });

  it('without the switch, the centre is HOLD TO TALK alone', () => {
    expect(centreMinWidth(null)).toBe(buttons.talk.size);
  });
});
