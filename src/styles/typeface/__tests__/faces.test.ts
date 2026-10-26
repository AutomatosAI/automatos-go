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
  });
});

describe('pickFace', () => {
  it('takes the weight asked for when the role has it', () => {
    expect(pickFace(STYLE_FACES.play.body, 500)).toEqual(face(F.geist, 500));
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
