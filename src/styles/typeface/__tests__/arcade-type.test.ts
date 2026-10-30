import { describe, expect, it } from 'vitest';

import { MIN_TEXT_SIZE } from '../../type';
import {
  ARCADE_BODY_MIN,
  ARCADE_DIALOGUE,
  ARCADE_LOST_NUMBER,
  ARCADE_SLOTS,
  ARCADE_STEPS,
  ARCADE_TITLES,
} from '../arcade-type';
import { DISPLAY_SLOTS, TITLE_ROLES, styleType, type DisplaySlot } from '../scale';

const arcade = styleType({ layout: 'arcade' });
const PIXEL = 'PressStart2P-Regular';
const PHONE_WIDTH = 390;
const GUTTER = 16;

/** The slots that are titles: Press Start 2P at 14-16 pt. */
const TITLE_SLOTS: readonly DisplaySlot[] = [
  'hero',
  'screenLg',
  'screen',
  'notRunning',
  'snag',
  'header',
  'card',
  'cardSm',
];
/** The slots that are labels: Press Start 2P at 11 pt, in capitals. */
const LABEL_SLOTS: readonly DisplaySlot[] = ['status', 'brand', 'panel'];

describe("Arcade's type (D-ARC-4)", () => {
  it('is its own frozen scale, not Studio’s', () => {
    expect(arcade).not.toBe(styleType({ layout: 'studio' }));
    expect(arcade).toBe(styleType({ layout: 'arcade' }));
    expect(Object.isFrozen(arcade)).toBe(true);
  });

  it('steps Press Start 2P at 11, 12, 14 and 16: the design’s 8, 10, 12 and 16 px over D38', () => {
    expect(ARCADE_STEPS).toEqual({ label: MIN_TEXT_SIZE, button: 12, title: 14, heading: 16 });
  });

  it('draws every title, label, counter, eyebrow and button in Press Start 2P', () => {
    for (const slot of DISPLAY_SLOTS) expect(arcade.display(slot).fontFamily).toBe(PIXEL);
    for (const role of TITLE_ROLES) expect(arcade.title(role).fontFamily).toBe(PIXEL);
    for (const style of [arcade.label, arcade.eyebrow, arcade.button]) {
      expect(style.fontFamily).toBe(PIXEL);
    }
  });

  it('sets titles at 14-16 pt with the kit’s 1.6 leading and .1em tracking, as written', () => {
    const titles = [
      ...TITLE_SLOTS.map((slot) => arcade.display(slot)),
      ...TITLE_ROLES.map((role) => arcade.title(role)),
    ];
    for (const style of titles) {
      expect(style.fontSize).toBeGreaterThanOrEqual(ARCADE_STEPS.title);
      expect(style.fontSize).toBeLessThanOrEqual(ARCADE_STEPS.heading);
      expect(style.lineHeight).toBe(Math.round(style.fontSize * 160) / 100);
      expect(style.letterSpacing).toBe(Math.round(style.fontSize * 10) / 100);
      expect(style).not.toHaveProperty('textTransform');
    }
    expect(arcade.display('hero')).toEqual({
      fontFamily: PIXEL,
      fontSize: 16,
      lineHeight: 25.6,
      letterSpacing: 1.6,
    });
    expect(arcade.display('card')).toMatchObject({ fontSize: 14, lineHeight: 22.4 });
  });

  it('keeps the title roles in rank: Title 1-3 and an answer’s h1 at 16, the rest at 14', () => {
    const sizes = TITLE_ROLES.map((role) => arcade.title(role).fontSize);
    expect(sizes).toEqual([16, 16, 16, 14, 14, 14, 16, 14]);
    expect(Object.keys(ARCADE_TITLES)).toEqual([...TITLE_ROLES]);
  });

  it('sets labels, eyebrows, the brand line and the state word at 11 in capitals', () => {
    const caps = { fontFamily: PIXEL, fontSize: 11, lineHeight: 17.6, textTransform: 'uppercase' };
    expect(arcade.label).toEqual({ ...caps, letterSpacing: 1.1 });
    expect(arcade.eyebrow).toEqual({ ...caps, letterSpacing: 1.32 });
    expect(arcade.display('brand')).toEqual({ ...caps, letterSpacing: 1.54 });
    expect(arcade.display('status')).toEqual({ ...caps, letterSpacing: 0.88 });
    expect(arcade.display('panel')).toEqual(arcade.label);
    for (const slot of LABEL_SLOTS) expect(arcade.display(slot).fontSize).toBe(MIN_TEXT_SIZE);
  });

  it('labels buttons at 12 in capitals, a step over the labels', () => {
    expect(arcade.button).toEqual({
      fontFamily: PIXEL,
      fontSize: 12,
      lineHeight: 16.8,
      letterSpacing: 0,
      textTransform: 'uppercase',
    });
  });

  it('draws a counter’s number at 16', () => {
    expect(arcade.display('number')).toEqual({
      fontFamily: PIXEL,
      fontSize: 16,
      lineHeight: 18.4,
      letterSpacing: 0,
    });
  });

  it("fits Lost's '404' (three full-em glyphs) inside the phone's gutters", () => {
    const lost = arcade.display('lostNumber');
    expect(lost).toEqual({ fontFamily: PIXEL, fontSize: 112, lineHeight: 112, letterSpacing: 0 });
    expect(3 * ARCADE_LOST_NUMBER.size).toBeLessThanOrEqual(PHONE_WIDTH - 2 * GUTTER);
    expect(ARCADE_LOST_NUMBER.size % 8).toBe(0);
  });

  it('names every slot', () => {
    expect(Object.keys(ARCADE_SLOTS)).toEqual([...DISPLAY_SLOTS]);
  });
});

describe("Arcade's running text and code", () => {
  it('sets running text in Pixelify Sans at the size asked, at a window’s 1.35', () => {
    expect(arcade.body(20)).toEqual({
      fontFamily: 'PixelifySans-Regular',
      fontSize: 20,
      lineHeight: 27,
      letterSpacing: 0,
    });
    expect(arcade.body(16, 600).fontFamily).toBe('PixelifySans-SemiBold');
  });

  it('never sets running text under the design’s 15', () => {
    expect(ARCADE_BODY_MIN).toBe(15);
    for (const size of [9, 11, 12, 13, 14]) expect(arcade.body(size).fontSize).toBe(15);
    expect(arcade.body(13).lineHeight).toBe(20.25);
  });

  it('sets the handheld’s dialogue line at 17/1.3', () => {
    expect(arcade.body(ARCADE_DIALOGUE.size)).toMatchObject({
      fontFamily: 'PixelifySans-Regular',
      fontSize: 17,
      lineHeight: 22.1,
    });
  });

  it('draws 500 at Pixelify 400 and 700 at its 600 (the two faces bundled)', () => {
    expect(arcade.body(17, 500).fontFamily).toBe('PixelifySans-Regular');
    expect(arcade.body(17, 700).fontFamily).toBe('PixelifySans-SemiBold');
  });

  it('keeps Geist Mono for code', () => {
    expect(arcade.mono(13)).toEqual({
      fontFamily: 'GeistMono-Regular',
      fontSize: 13,
      lineHeight: 19.5,
      letterSpacing: 0,
    });
    expect(arcade.mono(12, 600).fontFamily).toBe('GeistMono-SemiBold');
  });

  it('lets a layout set its own leading, tracking and capitals', () => {
    expect(arcade.body(18, 400, { leading: 1.2 }).lineHeight).toBe(21.6);
    expect(arcade.body(15, 400, { trackingEm: 0.1, uppercase: true })).toMatchObject({
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    });
  });
});
