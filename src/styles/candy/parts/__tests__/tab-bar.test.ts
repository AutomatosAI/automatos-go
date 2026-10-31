// Candy's tab bar (tab-bar.ts; CANDY-LAYOUT §4, P1/P3/P4): the design's measures at the default
// text size, and for every React Native iOS text-size multiplier on a 375 and a 430 pt phone the
// bar keeps its width, every tab its 44 pt and its column, and the bar grows taller only (the
// D-pad's lesson, A8 P001A-RVW-2). A tab is as tall as the lines its words wrap to (P001C-RVW-1:
// tabWordLines over Nunito ExtraBold's advance widths), and the room the bar takes grows with it.
// The tabs' paint, the raised voice's room and the space the bar takes over a view's foot; and
// TabBar.tsx lets a word wrap (no numberOfLines, a minHeight).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { candyTabLabel } from '../../../typeface/candy-type';
import { CANDY_COPY } from '../../strings';
import {
  CANDY_TABS,
  TAB_BAR,
  TAB_DOT_SET,
  TAB_GLYPH_EM,
  VOICE_SURROUND,
  tabBarMetrics,
  tabBarSpace,
  tabPaint,
  tabWordLines,
  voiceOver,
} from '../tab-bar';

/** React Native's iOS fontScale for each Dynamic Type size, xSmall to AX5. */
const IOS_MULTIPLIERS = [
  0.823, 0.882, 0.941, 1, 1.118, 1.235, 1.353, 1.786, 2.143, 2.643, 3.143, 3.571,
] as const;
const PHONES = [375, 430] as const;
const TAB_BAR_SOURCE = readFileSync(path.resolve(__dirname, '../TabBar.tsx'), 'utf8');
const WORDS = CANDY_TABS.map((tab) => CANDY_COPY.tabs[tab]);

/** The most lines any tab's word takes at this size in a tab this wide. */
const mostLines = (scale: number, width: number) =>
  Math.max(...WORDS.map((word) => tabWordLines(word, scale, width)));

/** A tab's content: its dot, the gap, `lines` lines of its word and the room above and below. */
const tabContent = (scale: number, lines: number) =>
  TAB_BAR.dot + TAB_BAR.gap + lines * candyTabLabel().lineHeight * scale + TAB_BAR.itemPadV * 2;

describe('tabBarMetrics at the default text size (the 390 pt frames)', () => {
  it('is a 72 pt pill 18 pt from each side, its tabs 56 pt circles', () => {
    const metrics = tabBarMetrics(1, 390);
    expect(metrics.barWidth).toBe(354);
    expect(metrics.barMinHeight).toBe(TAB_BAR.height);
    expect(metrics.item).toEqual({ width: 56, minHeight: 56, radius: 28 });
  });

  it('splits the bar into 1fr 1fr 76 1fr 1fr inside its 8 pt padding', () => {
    const metrics = tabBarMetrics(1, 390);
    expect(metrics.column * 4 + TAB_BAR.centre + TAB_BAR.padH * 2).toBeCloseTo(metrics.barWidth);
    expect(metrics.column).toBeCloseTo(65.5);
  });

  it('reads a text size or a width that is not a number as the design', () => {
    expect(tabBarMetrics(Number.NaN, 390)).toEqual(tabBarMetrics(1, 390));
    expect(tabBarMetrics(1, Number.NaN)).toEqual(tabBarMetrics(1, 390));
    expect(tabBarMetrics(0, 390)).toEqual(tabBarMetrics(1, 390));
  });
});

describe('tabBarMetrics at every iOS text size', () => {
  for (const width of PHONES) {
    for (const scale of IOS_MULTIPLIERS) {
      it(`keeps every target and the bar's width at ${scale} on a ${width} pt phone`, () => {
        const metrics = tabBarMetrics(scale, width);
        const { item } = metrics;
        expect(metrics.barWidth).toBe(width - TAB_BAR.side * 2);
        expect(item.width).toBeGreaterThanOrEqual(TAB_BAR.target);
        expect(item.width).toBeLessThanOrEqual(metrics.column);
        expect(item.minHeight).toBeGreaterThanOrEqual(Math.max(TAB_BAR.target, item.width));
        expect(metrics.barMinHeight).toBeGreaterThanOrEqual(item.minHeight + TAB_BAR.padV * 2);
        expect(metrics.barMinHeight).toBeGreaterThanOrEqual(TAB_BAR.height);
      });
    }

    it(`gives a tab room for its dot and every line its words wrap to on ${width} pt`, () => {
      for (const scale of IOS_MULTIPLIERS) {
        const metrics = tabBarMetrics(scale, width);
        const lines = mostLines(scale, metrics.item.width);
        const content = tabContent(scale, lines);
        expect({ scale, lines, fits: metrics.item.minHeight >= content }).toEqual({
          scale,
          lines,
          fits: true,
        });
        expect(metrics.item.minHeight).toBeGreaterThanOrEqual(tabContent(scale, 1));
        const room = TAB_BAR.bottom + content + TAB_BAR.padV * 2;
        expect(tabBarSpace(metrics, 0)).toBeGreaterThanOrEqual(room);
      }
    });

    it(`grows taller, never wider, as the text grows on ${width} pt`, () => {
      const all = IOS_MULTIPLIERS.map((scale) => tabBarMetrics(scale, width));
      all.slice(1).forEach((metrics, index) => {
        const before = all[index]!;
        expect(metrics.barWidth).toBe(before.barWidth);
        expect(metrics.barMinHeight).toBeGreaterThanOrEqual(before.barMinHeight);
        expect(metrics.item.minHeight).toBeGreaterThanOrEqual(before.item.minHeight);
        expect(tabBarSpace(metrics, 34)).toBeGreaterThanOrEqual(tabBarSpace(before, 34));
      });
      expect(all.at(-1)!.barMinHeight).toBeGreaterThan(TAB_BAR.height);
    });

    it(`keeps the one-line measures while every word fits its tab on ${width} pt`, () => {
      for (const scale of IOS_MULTIPLIERS.filter((size) => size <= 1.353)) {
        const metrics = tabBarMetrics(scale, width);
        expect(mostLines(scale, metrics.item.width)).toBe(1);
        const oneLine = Math.max(metrics.item.width, Math.ceil(tabContent(scale, 1)));
        expect(metrics.item.minHeight).toBe(oneLine);
        expect(metrics.barMinHeight).toBe(Math.max(TAB_BAR.height, oneLine + TAB_BAR.padV * 2));
      }
    });
  }

  it('keeps the circles at 56 under the default size', () => {
    for (const scale of [0.823, 0.882, 0.941]) {
      expect(tabBarMetrics(scale, 375).item).toEqual({ width: 56, minHeight: 56, radius: 28 });
    }
  });

  it("holds 'Today' in three lines at the largest size on a 375 pt phone", () => {
    const metrics = tabBarMetrics(3.571, 375);
    expect(metrics.item.width).toBe(61);
    expect(metrics.item.minHeight).toBeGreaterThanOrEqual(193);
    expect(metrics.barMinHeight).toBeGreaterThanOrEqual(193 + TAB_BAR.padV * 2);
  });

  it('sizes the tabs for the words it is given, the four tab words by default', () => {
    expect(tabBarMetrics(1, 390, WORDS)).toEqual(tabBarMetrics(1, 390));
    const long = tabBarMetrics(1, 390, ['Deliverables']);
    expect(long.item.width).toBe(56);
    expect(long.item.minHeight).toBeGreaterThanOrEqual(tabContent(1, 2));
  });
});

describe('the words in their tabs (Nunito ExtraBold at 12 pt × the text size)', () => {
  it("has every tab word's characters measured", () => {
    const characters = new Set(WORDS.join(''));
    const unmeasured = [...characters].filter((character) => TAB_GLYPH_EM[character] === undefined);
    expect(unmeasured).toEqual([]);
    expect(WORDS).toEqual(['Today', 'Chat', 'Shelf', 'Team']);
  });

  it('breaks a word between characters when it is wider than its tab', () => {
    expect(tabWordLines('Today', 1, 56)).toBe(1);
    expect(tabWordLines('Today', 1.786, 61)).toBe(2);
    expect(tabWordLines('Today', 3.571, 61)).toBe(3);
    expect(tabWordLines('Team', 3.571, 61)).toBe(3);
    expect(tabWordLines('Chat', 2.143, 61)).toBe(1);
    expect(tabWordLines('Today', 2.143, 75)).toBe(2);
  });

  it('takes at least one line, and one character a line however narrow the tab', () => {
    expect(tabWordLines('', 1, 56)).toBe(1);
    expect(tabWordLines('Team', 1, 1)).toBe(4);
  });

  it('counts a character it has not measured as the widest, never short', () => {
    expect(tabWordLines('ŵŵŵŵ', 2, 61)).toBe(tabWordLines('mmmm', 2, 61));
    expect(tabWordLines('ŵŵŵŵ', 2, 61)).toBeGreaterThanOrEqual(tabWordLines('Team', 2, 61));
  });
});

describe('the raised voice and the room the bar takes', () => {
  it('raises a 64 pt surround with its 3 pt ring 17 pt over a 72 pt bar', () => {
    expect(VOICE_SURROUND).toBe(70);
    expect(voiceOver(tabBarMetrics(1, 390))).toBe(17);
  });

  it('keeps less room over a taller bar, and none over one that holds the raised voice', () => {
    const big = tabBarMetrics(1.786, 375);
    expect(big.barMinHeight).toBe(97);
    expect(voiceOver(big)).toBe(TAB_BAR.raise + VOICE_SURROUND / 2 - big.barMinHeight / 2);
    expect(voiceOver(big)).toBeLessThan(17);
    const tall = { ...big, barMinHeight: (TAB_BAR.raise + VOICE_SURROUND / 2) * 2 + 10 };
    expect(voiceOver(tall)).toBe(0);
    expect(voiceOver(tabBarMetrics(3.571, 375))).toBe(0);
  });

  it('pads a view by the inset, the 22 pt, the bar and the voice over it', () => {
    expect(tabBarSpace(tabBarMetrics(1, 390), 34)).toBe(34 + 22 + 72 + 17);
    const big = tabBarMetrics(3.571, 430);
    expect(tabBarSpace(big, 0)).toBe(22 + big.barMinHeight + voiceOver(big));
  });
});

describe('tabPaint', () => {
  it('lists Today, Chat, Shelf and Team, their dots in sets 1, 2, 3, 1', () => {
    expect(CANDY_TABS).toEqual(['today', 'chat', 'shelf', 'team']);
    expect(CANDY_TABS.map((tab) => TAB_DOT_SET[tab])).toEqual([1, 2, 3, 1]);
  });

  it("fills the view on screen with the accent, its dot and word in the accent's ink", () => {
    expect(tabPaint('shelf', 'shelf')).toEqual({ fill: 'accent', ink: 'accentInk', dot: 'accentInk' });
  });

  it("leaves the others on the bar in text, each dot its set's start", () => {
    expect(CANDY_TABS.map((tab) => tabPaint(tab, 'shelf'))).toEqual([
      { fill: null, ink: 'text', dot: 'g1a' },
      { fill: null, ink: 'text', dot: 'g2a' },
      { fill: 'accent', ink: 'accentInk', dot: 'accentInk' },
      { fill: null, ink: 'text', dot: 'g1a' },
    ]);
    expect(tabPaint('today', null).fill).toBeNull();
  });
});

describe('TabBar.tsx', () => {
  it('lets a word wrap and a tab grow taller: no numberOfLines, a minHeight, never a height', () => {
    expect(TAB_BAR_SOURCE).not.toMatch(/numberOfLines/);
    expect(TAB_BAR_SOURCE).toMatch(/\{ width, minHeight, borderRadius: radius/);
    expect(TAB_BAR_SOURCE).toMatch(/tabBarMetrics\(fontScale, width\)/);
  });

  it('makes each item a tab with its selected state, inside a tablist', () => {
    expect(TAB_BAR_SOURCE).toMatch(/accessibilityRole="tab"/);
    expect(TAB_BAR_SOURCE).toMatch(/accessibilityState=\{\{ selected: tab === active \}\}/);
    expect(TAB_BAR_SOURCE).toMatch(/accessibilityRole="tablist"/);
  });
});
