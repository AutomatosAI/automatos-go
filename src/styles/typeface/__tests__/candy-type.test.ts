import { describe, expect, it } from 'vitest';

import { MIN_TEXT_SIZE, type TypeStyle } from '../../type';
import {
  CANDY_LEADING,
  CANDY_LOST_NUMBER,
  CANDY_MIN,
  CANDY_SLOTS,
  CANDY_STEPS,
  CANDY_TITLES,
  candyOrbFigure,
  candyTabLabel,
} from '../candy-type';
import { DISPLAY_SLOTS, TITLE_ROLES, styleType, type DisplaySlot } from '../scale';

const candy = styleType({ layout: 'candy' });
const TITLE = 'Outfit-SemiBold';
const FIGURE = 'Outfit-Bold';
const REGULAR = 'Nunito-Regular';
const BOLD = 'Nunito-Bold';
const EXTRA = 'Nunito-ExtraBold';
const PHONE_WIDTH = 390;
const GUTTER = 16;
/** Outfit SemiBold's advances (hmtx, 1000 units per em): '4' 604, '0' 660. */
const OUTFIT_404_EM = 0.604 + 0.66 + 0.604;

const text = (fontFamily: string, fontSize: number, lineHeight: number): TypeStyle => ({
  fontFamily,
  fontSize,
  lineHeight,
  letterSpacing: 0,
});

/** Every display slot as the phone draws it: [face, size, line height]. */
const SLOTS: Record<DisplaySlot, [string, number, number]> = {
  hero: [TITLE, 28, 30.8],
  screenLg: [TITLE, 30, 33],
  screen: [TITLE, 30, 33],
  notRunning: [TITLE, 30, 33],
  snag: [TITLE, 20, 24],
  status: [EXTRA, 13, 16.9],
  header: [TITLE, 17, 20.4],
  card: [TITLE, 17, 20.4],
  cardSm: [EXTRA, 13, 16.9],
  lostNumber: [TITLE, 180, 144],
  brand: [TITLE, 20, 24],
  panel: [EXTRA, 13, 16.9],
  number: [TITLE, 34, 35.7],
};

/** Every style the type hands out at its own steps (body and mono sized by the caller). */
function everyStep(): [string, TypeStyle][] {
  return [
    ...DISPLAY_SLOTS.map((slot) => [`display ${slot}`, candy.display(slot)] as [string, TypeStyle]),
    ...TITLE_ROLES.map((role) => [`title ${role}`, candy.title(role)] as [string, TypeStyle]),
    ['label', candy.label],
    ['eyebrow', candy.eyebrow],
    ['button', candy.button],
    ['orb', candyOrbFigure()],
    ['tab', candyTabLabel()],
  ];
}

describe("Candy's type (D-CAN-4)", () => {
  it('is its own frozen scale, not Studio’s or Arcade’s', () => {
    expect(candy).not.toBe(styleType({ layout: 'studio' }));
    expect(candy).not.toBe(styleType({ layout: 'arcade' }));
    expect(candy).toBe(styleType({ layout: 'candy' }));
    expect(Object.isFrozen(candy)).toBe(true);
  });

  it('steps at the design’s sizes, none under 12 (D-A11Y)', () => {
    expect(CANDY_STEPS).toEqual({
      view: 30,
      greeting: 28,
      section: 20,
      card: 17,
      orb: 60,
      stat: 34,
      body: 15,
      message: 14,
      label: 14,
      meta: 13,
      button: 13,
      cardLabel: 13,
      tab: 12,
    });
    expect(CANDY_MIN).toBe(12);
    expect(CANDY_MIN).toBeGreaterThan(MIN_TEXT_SIZE);
    expect(Math.min(...Object.values(CANDY_STEPS))).toBe(CANDY_MIN);
  });

  it('keeps the frames’ and the kit’s leading, a title’s at the greeting’s 1.1', () => {
    expect(CANDY_LEADING).toEqual({
      title: 1.1,
      heading: 1.2,
      figure: 1.05,
      text: 1.45,
      label: 1.3,
    });
  });

  it('draws every display slot at its face, size and leading', () => {
    for (const slot of DISPLAY_SLOTS) {
      const [face, size, lineHeight] = SLOTS[slot];
      expect({ slot, style: candy.display(slot) }).toEqual({
        slot,
        style: text(face, size, lineHeight),
      });
    }
    expect(Object.keys(CANDY_SLOTS)).toEqual([...DISPLAY_SLOTS]);
  });

  it('sets the title roles in Outfit 600: a view 30, the greeting 28, a section 20, a card 17', () => {
    expect(TITLE_ROLES.map((role) => candy.title(role).fontSize)).toEqual([
      30, 28, 20, 17, 17, 17, 20, 17,
    ]);
    for (const role of TITLE_ROLES) expect(candy.title(role).fontFamily).toBe(TITLE);
    expect(candy.title('title1')).toEqual(text(TITLE, 30, 33));
    expect(candy.title('title2')).toEqual(text(TITLE, 28, 30.8));
    expect(candy.title('title3')).toEqual(text(TITLE, 20, 24));
    expect(candy.title('threadTitle2')).toEqual(text(TITLE, 17, 20.4));
    expect(Object.keys(CANDY_TITLES)).toEqual([...TITLE_ROLES]);
  });

  it('sets labels 14 and meta 13 in Nunito 700, buttons 13 in its 800', () => {
    expect(candy.label).toEqual(text(BOLD, 14, 18.2));
    expect(candy.eyebrow).toEqual(text(BOLD, 13, 16.9));
    expect(candy.button).toEqual(text(EXTRA, 13, 16.9));
  });

  it('draws the figures in Outfit: the orb’s 700 at 60/1.05, a stat card’s 600 at 34/1.05', () => {
    expect(candyOrbFigure()).toEqual(text(FIGURE, 60, 63));
    expect(candy.display('number')).toEqual(text(TITLE, 34, 35.7));
  });

  it('labels the tab bar in Nunito 800 at 12, at a leading that lets it wrap', () => {
    expect(candyTabLabel()).toEqual(text(EXTRA, 12, 15.6));
    expect(candyTabLabel().lineHeight).toBeGreaterThan(CANDY_STEPS.tab);
  });

  it('never draws a step under 12 and never in capitals or with tracking', () => {
    for (const [what, style] of everyStep()) {
      expect({ what, ok: style.fontSize >= CANDY_MIN }).toEqual({ what, ok: true });
      expect({ what, style }).not.toHaveProperty('style.textTransform');
      expect({ what, letterSpacing: style.letterSpacing }).toEqual({ what, letterSpacing: 0 });
    }
  });

  it("fits Lost's decorative '404' inside the phone's gutters", () => {
    expect(CANDY_LOST_NUMBER).toEqual({ size: 180, leading: 0.8 });
    expect(OUTFIT_404_EM * CANDY_LOST_NUMBER.size).toBeLessThanOrEqual(PHONE_WIDTH - 2 * GUTTER);
  });
});

describe("Candy's running text and code", () => {
  it('sets a message at Nunito 14/1.45 and body at 15/1.45', () => {
    expect(candy.body(CANDY_STEPS.message)).toEqual(text(REGULAR, 14, 20.3));
    expect(candy.body(CANDY_STEPS.body)).toEqual(text(REGULAR, 15, 21.75));
  });

  it('draws 700 at Nunito Bold and 800 at its ExtraBold; 500 and 600 at Nunito 400', () => {
    expect(candy.body(14, 700).fontFamily).toBe(BOLD);
    expect(candy.body(14, 800).fontFamily).toBe(EXTRA);
    expect(candy.body(14, 600).fontFamily).toBe(REGULAR);
    expect(candy.body(14, 500).fontFamily).toBe(REGULAR);
  });

  it('never sets running text or code under 12: the design’s 10 and 11 px are 12', () => {
    for (const size of [8, 10, 11]) {
      expect(candy.body(size).fontSize).toBe(CANDY_MIN);
      expect(candy.mono(size).fontSize).toBe(CANDY_MIN);
    }
    expect(candy.body(11)).toEqual(text(REGULAR, 12, 17.4));
  });

  it('keeps Geist Mono for code', () => {
    expect(candy.mono(13)).toEqual(text('GeistMono-Regular', 13, 19.5));
    expect(candy.mono(12, 600).fontFamily).toBe('GeistMono-SemiBold');
  });

  it('lets a layout set its own leading, tracking and capitals', () => {
    expect(candy.body(14, 800, { leading: 1.2 }).lineHeight).toBe(16.8);
    expect(candy.body(13, 700, { trackingEm: 0.1, uppercase: true })).toMatchObject({
      letterSpacing: 1.3,
      textTransform: 'uppercase',
    });
  });
});
