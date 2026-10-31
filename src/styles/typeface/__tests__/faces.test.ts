import { describe, expect, it } from 'vitest';

import { TYPE_STYLE_KEYS } from '../../../core/frozen/lib/looks/catalogue';
import { FONT_FACES, FONT_FAMILIES as F, fontFace } from '../../fonts';
import { BUILT_IN_STYLE_IDS } from '../../registry/style-id';
import { HUD_FONT_KEYS } from '../../tokens/hud-catalogue';
import { STYLE_FACES, faceFor, facesOf, hudDisplayFace, pickFace, playDisplayFace } from '../faces';

const face = (family: string, weight: number, style = 'normal') => ({ family, weight, style });

describe('STYLE_FACES', () => {
  it('gives Studio Newsreader 500 titles (italic 500 for emphasis), Geist and Geist Mono 400-600', () => {
    expect(STYLE_FACES.studio).toEqual({
      display: { serif: face(F.newsreader, 500) },
      emphasis: face(F.newsreader, 500, 'italic'),
      body: [face(F.geist, 400), face(F.geist, 500), face(F.geist, 600)],
      mono: [face(F.geistMono, 400), face(F.geistMono, 500), face(F.geistMono, 600)],
    });
  });

  it('gives Play the display face its font knob picks, Geist 400-600 and Geist Mono 400/500', () => {
    expect(STYLE_FACES.play).toEqual({
      display: {
        serif: face(F.instrumentSerif, 400, 'italic'),
        clean: face(F.geist, 600),
        bric: face(F.bricolageGrotesque, 700),
        round: face(F.fredoka, 600),
      },
      body: [face(F.geist, 400), face(F.geist, 500), face(F.geist, 600)],
      mono: [face(F.geistMono, 400), face(F.geistMono, 500)],
    });
    expect(Object.keys(STYLE_FACES.play.display)).toEqual([...TYPE_STYLE_KEYS]);
  });

  it("gives HUD looks.json's display faces, Geist and Geist Mono", () => {
    expect(STYLE_FACES.hud.display).toEqual({
      raj: face(F.rajdhani, 700),
      chakra: face(F.chakraPetch, 600),
      mono: face(F.geistMono, 500),
    });
    expect(Object.keys(STYLE_FACES.hud.display)).toEqual([...HUD_FONT_KEYS]);
    expect(STYLE_FACES.hud.body.every((item) => item.family === F.geist)).toBe(true);
    expect(STYLE_FACES.hud.mono.every((item) => item.family === F.geistMono)).toBe(true);
  });

  it('gives Arcade Press Start 2P for its pixel slots, Pixelify Sans 400/600 and Geist Mono', () => {
    expect(STYLE_FACES.arcade).toEqual({
      display: { pixel: face(F.pressStart2p, 400) },
      body: [face(F.pixelifySans, 400), face(F.pixelifySans, 600)],
      mono: [face(F.geistMono, 400), face(F.geistMono, 500), face(F.geistMono, 600)],
    });
    expect(STYLE_FACES.arcade).not.toBe(STYLE_FACES.studio);
  });

  it('gives Candy Outfit 600 titles and its 700 figure, Nunito 400/700/800 and Geist Mono', () => {
    expect(STYLE_FACES.candy).toEqual({
      display: { title: face(F.outfit, 600), figure: face(F.outfit, 700) },
      body: [face(F.nunito, 400), face(F.nunito, 700), face(F.nunito, 800)],
      mono: [face(F.geistMono, 400), face(F.geistMono, 500), face(F.geistMono, 600)],
    });
    expect(STYLE_FACES.candy).not.toBe(STYLE_FACES.studio);
  });

  it('asks only for faces the app bundles (FONT_FACES), in every style', () => {
    for (const id of BUILT_IN_STYLE_IDS) {
      for (const item of facesOf(STYLE_FACES[id])) {
        const bundled = fontFace(item.family, item.weight, item.style);
        expect({ id, ...item, bundled: bundled !== undefined }).toEqual({
          id,
          ...item,
          bundled: true,
        });
      }
    }
  });

  it('reads the display faces by font knob', () => {
    expect(playDisplayFace('serif')).toBe(STYLE_FACES.play.display.serif);
    expect(hudDisplayFace('chakra')).toBe(STYLE_FACES.hud.display.chakra);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(STYLE_FACES)).toBe(true);
    expect(Object.isFrozen(STYLE_FACES.play.display)).toBe(true);
    expect(Object.isFrozen(STYLE_FACES.hud.body)).toBe(true);
    expect(Object.isFrozen(STYLE_FACES.arcade.display)).toBe(true);
    expect(Object.isFrozen(STYLE_FACES.arcade.body)).toBe(true);
    expect(Object.isFrozen(STYLE_FACES.candy.display)).toBe(true);
    expect(Object.isFrozen(STYLE_FACES.candy.body)).toBe(true);
  });
});

describe('pickFace', () => {
  it('takes the weight asked for when the role has it', () => {
    expect(pickFace(STYLE_FACES.play.body, 500)).toEqual(face(F.geist, 500));
  });

  it("draws Arcade's 500 at Pixelify 400, the heaviest lighter face", () => {
    expect(pickFace(STYLE_FACES.arcade.body, 500)).toEqual(face(F.pixelifySans, 400));
  });

  it("draws Candy's 800 at Nunito ExtraBold, and its 500 and 600 at Nunito 400", () => {
    expect(pickFace(STYLE_FACES.candy.body, 800)).toEqual(face(F.nunito, 800));
    expect(pickFace(STYLE_FACES.candy.body, 600)).toEqual(face(F.nunito, 400));
    expect(pickFace(STYLE_FACES.candy.body, 500)).toEqual(face(F.nunito, 400));
  });

  it("draws Studio's 800 at Geist 600, the heaviest it has", () => {
    expect(pickFace(STYLE_FACES.studio.body, 800)).toEqual(face(F.geist, 600));
  });

  it("maps Ember's Geist 700 to 600, the heaviest the app bundles", () => {
    expect(pickFace(STYLE_FACES.play.body, 700)).toEqual(face(F.geist, 600));
  });

  it("keeps Play's mono at 400/500: 600 is drawn at 500", () => {
    expect(pickFace(STYLE_FACES.play.mono, 600)).toEqual(face(F.geistMono, 500));
  });

  it('throws for a role with no faces', () => {
    expect(() => pickFace([], 400)).toThrow('no faces');
  });
});

describe('faceFor', () => {
  it("names the face as React Native needs it: the TTF's PostScript name", () => {
    expect(faceFor(F.rajdhani, 700)).toBe('Rajdhani-Bold');
    expect(faceFor(F.chakraPetch, 600)).toBe('ChakraPetch-SemiBold');
    expect(faceFor(F.instrumentSerif, 400, 'italic')).toBe('InstrumentSerif-Italic');
    expect(faceFor(F.newsreader, 500, 'italic')).toBe('Newsreader16pt16pt-MediumItalic');
    expect(faceFor(F.pressStart2p, 400)).toBe('PressStart2P-Regular');
    expect(faceFor(F.pixelifySans, 600)).toBe('PixelifySans-SemiBold');
    expect(faceFor(F.outfit, 600)).toBe('Outfit-SemiBold');
    expect(faceFor(F.outfit, 700)).toBe('Outfit-Bold');
    expect(faceFor(F.nunito, 800)).toBe('Nunito-ExtraBold');
  });

  it('throws for a face the app does not bundle', () => {
    expect(() => faceFor(F.geist, 700)).toThrow('is not bundled');
  });

  it('only ever returns a bundled PostScript name', () => {
    const names = new Set([...FONT_FACES.values()].map((item) => item.postscriptName));
    for (const id of BUILT_IN_STYLE_IDS) {
      for (const item of facesOf(STYLE_FACES[id])) {
        expect(names.has(faceFor(item.family, item.weight, item.style))).toBe(true);
      }
    }
  });
});
