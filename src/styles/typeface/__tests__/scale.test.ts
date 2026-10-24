import { describe, expect, it } from 'vitest';

import { TYPE_STYLE_KEYS, type TypeStyleKey } from '../../../core/web/lib/looks/catalogue';
import { BUTTON_LABEL_WEIGHT, BUTTON_SIZES, textRole } from '../../../ui/variants';
import { FONT_FACES } from '../../fonts';
import { HUD_FONT_KEYS, type HudFontKey } from '../../tokens/hud-catalogue';
import { MIN_TEXT_SIZE, STUDIO_TYPE, TEXT_SCALING, typeStyle, type TypeStyle } from '../../type';
import { PLAY_DISPLAY_MIN, PLAY_SLOTS, playSlotSize } from '../play-type';
import {
  DISPLAY_SLOTS,
  TITLE_ROLES,
  styleType,
  type DisplaySlot,
  type StyleType,
  type TypeSource,
} from '../scale';
import { STUDIO_SLOT_ROLES } from '../studio-type';

const SOURCES: readonly TypeSource[] = [
  { layout: 'studio' },
  ...TYPE_STYLE_KEYS.map((font) => ({ layout: 'play' as const, font })),
  ...HUD_FONT_KEYS.map((font) => ({ layout: 'hud' as const, font })),
];

const ASKED_SIZES = [8, 10, 10.5, 11, 12, 13, 15, 16, 19];
const WEIGHTS = [400, 500, 600, 700] as const;

const nameOf = (source: TypeSource) =>
  source.layout === 'studio' ? 'studio' : `${source.layout}/${source.font}`;

/** Every text style a style can hand a layout. */
function everyStyle(type: StyleType): [string, TypeStyle][] {
  const sized = ASKED_SIZES.flatMap((size) =>
    WEIGHTS.flatMap((weight) => [
      [`body ${size} ${weight}`, type.body(size, weight)] as [string, TypeStyle],
      [`mono ${size} ${weight}`, type.mono(size, weight)] as [string, TypeStyle],
    ]),
  );
  return [
    ...DISPLAY_SLOTS.map((slot) => [`display ${slot}`, type.display(slot)] as [string, TypeStyle]),
    ...TITLE_ROLES.map((role) => [`title ${role}`, type.title(role)] as [string, TypeStyle]),
    ['label', type.label],
    ['eyebrow', type.eyebrow],
    ['button', type.button],
    ...sized,
  ];
}

const play = (font: TypeStyleKey) => styleType({ layout: 'play', font });
const hud = (font: HudFontKey) => styleType({ layout: 'hud', font });
const studio = styleType({ layout: 'studio' });
const sizeOf = (type: StyleType, slot: DisplaySlot) => type.display(slot).fontSize;

describe('every style, font option and slot', () => {
  it('is never below 11 pt (D38), even when a layout asks for less', () => {
    for (const source of SOURCES) {
      for (const [what, style] of everyStyle(styleType(source))) {
        expect({ at: `${nameOf(source)} ${what}`, ok: style.fontSize >= MIN_TEXT_SIZE }).toEqual({
          at: `${nameOf(source)} ${what}`,
          ok: true,
        });
      }
    }
  });

  it('never draws Instrument Serif below 19 pt', () => {
    for (const source of SOURCES) {
      for (const [what, style] of everyStyle(styleType(source))) {
        if (style.fontFamily !== 'InstrumentSerif-Italic') continue;
        expect({ at: `${nameOf(source)} ${what}`, size: style.fontSize >= 19 }).toEqual({
          at: `${nameOf(source)} ${what}`,
          size: true,
        });
      }
    }
  });

  it('only names bundled faces', () => {
    const names = new Set([...FONT_FACES.values()].map((face) => face.postscriptName));
    for (const source of SOURCES) {
      for (const [, style] of everyStyle(styleType(source))) {
        expect(names.has(style.fontFamily)).toBe(true);
      }
    }
  });

  it('leaves Dynamic Type on: plain text styles, the Text primitive scales them uncapped', () => {
    expect(TEXT_SCALING).toEqual({ allowFontScaling: true });
    const allowed = [
      'fontFamily',
      'fontSize',
      'lineHeight',
      'letterSpacing',
      'textTransform',
      'fontVariant',
    ];
    for (const source of SOURCES) {
      for (const [, style] of everyStyle(styleType(source))) {
        expect(Object.keys(style).every((key) => allowed.includes(key))).toBe(true);
      }
    }
  });

  it('is built once per layout and font knob, frozen', () => {
    for (const source of SOURCES) {
      expect(styleType(source)).toBe(styleType({ ...source }));
      expect(Object.isFrozen(styleType(source))).toBe(true);
    }
  });

  it('hands out the same frozen text style for a slot or a role each time (stable for memo)', () => {
    for (const source of SOURCES) {
      const type = styleType(source);
      for (const slot of DISPLAY_SLOTS) {
        expect(type.display(slot)).toBe(type.display(slot));
        expect(Object.isFrozen(type.display(slot))).toBe(true);
      }
      for (const role of TITLE_ROLES) expect(type.title(role)).toBe(type.title(role));
    }
  });
});

describe('Studio', () => {
  it("is the foundation's scale unchanged", () => {
    for (const role of TITLE_ROLES) expect(studio.title(role)).toBe(STUDIO_TYPE[role]);
    expect(studio.label).toBe(STUDIO_TYPE.label);
    expect(studio.eyebrow).toBe(STUDIO_TYPE.eyebrow);
  });

  it("labels buttons as the foundation's md Button does", () => {
    const role = textRole('body', BUTTON_SIZES.md.level);
    expect(studio.button).toEqual(typeStyle(role, { weight: BUTTON_LABEL_WEIGHT }));
  });

  it('answers each display slot with a role of its scale', () => {
    for (const [slot, role] of Object.entries(STUDIO_SLOT_ROLES)) {
      expect(studio.display(slot as DisplaySlot)).toBe(STUDIO_TYPE[role]);
    }
    expect(studio.display('hero')).toMatchObject({
      fontFamily: 'Newsreader16pt16pt-Medium',
      fontSize: 28,
    });
  });

  it("draws Lost's decorative 404 at 200/0.8 in Newsreader", () => {
    expect(studio.display('lostNumber')).toMatchObject({
      fontFamily: 'Newsreader16pt16pt-Medium',
      fontSize: 200,
      lineHeight: 160,
    });
  });

  it('sets body and mono in Geist and Geist Mono at the weight asked for', () => {
    expect(studio.body(16)).toEqual({
      fontFamily: 'Geist-Regular',
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: 0,
    });
    expect(studio.mono(12, 600).fontFamily).toBe('GeistMono-SemiBold');
  });
});

describe('Play at the Editorial look (Ember’s 390 pt screens)', () => {
  const serif = play('serif');
  const expected: Record<keyof typeof PLAY_SLOTS, [number, number]> = {
    hero: [58, 53.36],
    screenLg: [48, 43.2],
    screen: [44, 41.8],
    notRunning: [52, 47.84],
    status: [26, 26],
    header: [22, 24.2],
    card: [24, 24],
    cardSm: [19, 19],
    lostNumber: [200, 160],
  };

  it('draws each display slot in Instrument Serif italic at its size and leading', () => {
    for (const [slot, [size, lineHeight]] of Object.entries(expected)) {
      expect(serif.display(slot as DisplaySlot)).toEqual({
        fontFamily: 'InstrumentSerif-Italic',
        fontSize: size,
        lineHeight,
        letterSpacing: 0,
      });
    }
  });

  it('draws the brand as its header, a big number as its status, a panel label as its label', () => {
    expect(serif.display('brand')).toEqual(serif.display('header'));
    expect(serif.display('number')).toEqual(serif.display('status'));
    expect(serif.display('panel')).toEqual(serif.label);
  });

  it('sets titles in the display face only at 19 and above; smaller ones in Geist 600', () => {
    expect(serif.title('title1')).toMatchObject({
      fontFamily: 'InstrumentSerif-Italic',
      fontSize: 28,
    });
    expect(serif.title('threadTitle1')).toMatchObject({
      fontFamily: 'InstrumentSerif-Italic',
      fontSize: 19,
    });
    expect(serif.title('threadTitle2')).toMatchObject({
      fontFamily: 'Geist-SemiBold',
      fontSize: 17,
    });
    expect(serif.title('title4')).toEqual({
      fontFamily: 'Geist-SemiBold',
      fontSize: 15,
      lineHeight: 17.25,
      letterSpacing: -0.45,
    });
    expect(PLAY_DISPLAY_MIN).toBe(19);
  });

  it('sets the thread at 16/1.6, bubbles at 15/1.5, Ember’s 700 at Geist 600', () => {
    expect(serif.body(16)).toMatchObject({ fontFamily: 'Geist-Regular', lineHeight: 25.6 });
    expect(serif.body(15)).toMatchObject({ fontFamily: 'Geist-Regular', lineHeight: 22.5 });
    expect(serif.body(14, 700).fontFamily).toBe('Geist-SemiBold');
  });

  it('sets mono in Geist Mono 400/500, buttons in Geist 600 14, labels Geist 500 11 caps at .14em', () => {
    expect(serif.mono(12)).toMatchObject({ fontFamily: 'GeistMono-Regular', fontSize: 12 });
    expect(serif.mono(13, 600).fontFamily).toBe('GeistMono-Medium');
    expect(serif.button).toMatchObject({ fontFamily: 'Geist-SemiBold', fontSize: 14 });
    const label = {
      fontFamily: 'Geist-Medium',
      fontSize: 11,
      letterSpacing: 1.54,
      textTransform: 'uppercase',
    };
    expect(serif.label).toMatchObject(label);
    expect(serif.eyebrow).toMatchObject(label);
  });

  it('lets a layout set its own leading, tracking and capitals', () => {
    expect(serif.mono(12, 400, { leading: 1.7 }).lineHeight).toBe(20.4);
    expect(serif.body(11, 500, { trackingEm: 0.14, uppercase: true })).toMatchObject({
      letterSpacing: 1.54,
      textTransform: 'uppercase',
    });
  });
});

describe("Play's other looks: each slot scaled by the web's ratio", () => {
  // TYPE_STYLES sizes: serif hero 72 brand 28 status 40 card 22; clean and bric 58 18 30 17;
  // round 58 20 30 17. hero 58·58/72 = 46.7, header 22·18/28 = 14.1 (round 22·20/28 = 15.7),
  // status 26·30/40 = 19.5, card 24·17/22 = 18.5, cardSm 19·17/22 = 14.7, 404 200·58/72 = 161.1.
  const clean = {
    hero: 47,
    screenLg: 39,
    screen: 35,
    notRunning: 42,
    status: 20,
    header: 14,
    card: 19,
    cardSm: 15,
    lostNumber: 161,
  };
  const ratios: Record<Exclude<TypeStyleKey, 'serif'>, typeof clean> = {
    clean,
    bric: clean,
    round: { ...clean, header: 16 },
  };

  it('for Clean, Characterful and Playful', () => {
    for (const [font, sizes] of Object.entries(ratios)) {
      for (const [slot, size] of Object.entries(sizes)) {
        const key = font as TypeStyleKey;
        expect({ font, slot, size: sizeOf(play(key), slot as DisplaySlot) }).toEqual({
          font,
          slot,
          size,
        });
        expect(playSlotSize(key, slot as keyof typeof PLAY_SLOTS)).toBe(size);
      }
    }
  });

  it("draws each in its own face with the web's tracking", () => {
    expect(play('clean').display('hero')).toMatchObject({
      fontFamily: 'Geist-SemiBold',
      letterSpacing: -1.41,
    });
    expect(play('bric').display('hero')).toMatchObject({
      fontFamily: 'BricolageGrotesque96ptExtraBold-Bold',
      letterSpacing: -0.94,
    });
    expect(play('round').display('header')).toMatchObject({
      fontFamily: 'FredokaLight-SemiBold',
      letterSpacing: 0,
    });
  });

  it('keeps the slot leading the Editorial look has', () => {
    expect(play('clean').display('hero').lineHeight).toBe(43.24);
    expect(play('round').display('card').lineHeight).toBe(19);
  });

  it('falls small titles to Geist 600 in every look', () => {
    expect(play('bric').title('title1').fontFamily).toBe('BricolageGrotesque96ptExtraBold-Bold');
    expect(play('bric').title('title6').fontFamily).toBe('Geist-SemiBold');
    expect(play('round').title('title5').fontFamily).toBe('Geist-SemiBold');
  });
});

describe('HUD', () => {
  const faces: Record<HudFontKey, string> = {
    raj: 'Rajdhani-Bold',
    chakra: 'ChakraPetch-SemiBold',
    mono: 'GeistMono-Medium',
  };
  const labelPx: Record<HudFontKey, number> = { raj: 13, chakra: 12, mono: 11 };

  it('draws the brand line in the display face at 16, .18em', () => {
    for (const font of HUD_FONT_KEYS) {
      expect(hud(font).display('brand')).toMatchObject({
        fontFamily: faces[font],
        fontSize: 16,
        letterSpacing: 2.88,
        textTransform: 'uppercase',
      });
    }
  });

  it("draws panel labels at the font's labelPx, .2em, in capitals", () => {
    for (const font of HUD_FONT_KEYS) {
      const size = labelPx[font];
      const style = {
        fontFamily: faces[font],
        fontSize: size,
        letterSpacing: Math.round(size * 20) / 100,
      };
      expect(hud(font).display('panel')).toMatchObject({ ...style, textTransform: 'uppercase' });
      expect(hud(font).display('card')).toEqual(hud(font).display('panel'));
    }
  });

  it('draws big numbers and the large slots at 24, .04em', () => {
    for (const slot of ['number', 'hero', 'screen', 'notRunning', 'status'] as const) {
      expect(hud('raj').display(slot)).toEqual({
        fontFamily: 'Rajdhani-Bold',
        fontSize: 24,
        lineHeight: 26.4,
        letterSpacing: 0.96,
      });
    }
  });

  it("sets the user's line at Geist 15/1.5 and Auto's at 19/1.45", () => {
    expect(hud('chakra').body(15)).toEqual({
      fontFamily: 'Geist-Regular',
      fontSize: 15,
      lineHeight: 22.5,
      letterSpacing: 0,
    });
    expect(hud('chakra').body(19).lineHeight).toBe(27.55);
  });

  it('sets mono labels in Geist Mono 500 11 caps (.1em, .16em) and buttons Geist Mono 12 caps .14em', () => {
    const type = hud('raj');
    const caps = { fontFamily: 'GeistMono-Medium', textTransform: 'uppercase' };
    expect(type.label).toMatchObject({ ...caps, fontSize: 11, letterSpacing: 1.1 });
    expect(type.eyebrow).toMatchObject({ ...caps, fontSize: 11, letterSpacing: 1.76 });
    expect(type.button).toMatchObject({ ...caps, fontSize: 12, letterSpacing: 1.68 });
  });

  it("sets titles in the display face at Studio's sizes", () => {
    expect(hud('chakra').title('title1')).toMatchObject({
      fontFamily: 'ChakraPetch-SemiBold',
      fontSize: 28,
    });
    expect(hud('mono').title('title6')).toMatchObject({
      fontFamily: 'GeistMono-Medium',
      fontSize: 14,
    });
  });
});
