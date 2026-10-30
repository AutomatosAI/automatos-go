// The faces each built-in style draws with (PRD-001 §4.6, D57), over the foundation's FONT_FACES
// (fonts.ts), so every face named here is an embedded TTF and nothing is fetched or loaded at run
// time (D-FONTS). Studio: Newsreader 500 titles (italic 500 for emphasis), Geist, Geist Mono.
// Play: the display face the look's font knob picks from the vendored TYPE_STYLES (Editorial
// Instrument Serif 400 italic, Clean Geist 600, Characterful Bricolage Grotesque 700, Playful
// Fredoka 600), Geist 400-600 (Ember draws a few labels at 700: they take 600, the heaviest Geist
// the app bundles) and Geist Mono 400/500. HUD: looks.json's display face by its font knob
// (Rajdhani 700, Chakra Petch 600, Geist Mono 500), Geist and Geist Mono. Arcade (no font knob):
// Press Start 2P 400, its one face, for titles, labels, counters, eyebrows and buttons; Pixelify
// Sans 400 and 600 for running text (the design kit's two Pixelify faces); Geist Mono for code.
// Candy (no font knob, D-CAN-4): Outfit 600 for titles and figures, its 700 for the orb's figure;
// Nunito 400 for running text, 700 for labels and meta, 800 for buttons and card labels; Geist
// Mono for code.

import { TYPE_STYLES, type TypeStyleKey } from '../../core/frozen/lib/looks/catalogue';
import {
  FONT_FAMILIES,
  fontFace,
  type FontFamily,
  type FontStyle,
  type FontWeight,
} from '../fonts';
import type { BuiltInStyleId } from '../registry/style-id';
import { HUD_FONTS, type HudFontKey } from '../tokens/hud-catalogue';

/** A face by what CSS calls it: family, weight and style. */
export type FaceSpec = {
  readonly family: FontFamily;
  readonly weight: FontWeight;
  readonly style: FontStyle;
};

/** What a style draws: a display face per font knob, its body faces and its mono faces. */
export type StyleFaceSet = {
  /**
   * Titles and display slots: a face per font knob, or the style's own (Studio's serif, Arcade's
   * pixel, Candy's title and figure).
   */
  readonly display: Readonly<Record<string, FaceSpec>>;
  /** Studio's emphasis in a title (Newsreader 500 italic); Play, HUD, Arcade and Candy have none. */
  readonly emphasis?: FaceSpec;
  readonly body: readonly FaceSpec[];
  readonly mono: readonly FaceSpec[];
};

const FONT_WEIGHTS: readonly FontWeight[] = [400, 500, 600, 700, 800];

function spec(family: FontFamily, weight: FontWeight, style: FontStyle = 'normal'): FaceSpec {
  return Object.freeze({ family, weight, style });
}

function isFontFamily(name: string): name is FontFamily {
  return (Object.values(FONT_FAMILIES) as string[]).includes(name);
}

function isFontWeight(weight: number): weight is FontWeight {
  return (FONT_WEIGHTS as number[]).includes(weight);
}

/** A design's face (a vendored type style, a looks.json font) as a FaceSpec; throws if unknown. */
function designFace(family: string, weight: number, style: FontStyle): FaceSpec {
  if (!isFontFamily(family)) throw new Error(`${family} is not one of the app's font families`);
  if (!isFontWeight(weight)) throw new Error(`${family} ${weight} is not a weight the app uses`);
  return spec(family, weight, style);
}

function mapKeys<K extends string, T, U>(record: Readonly<Record<K, T>>, to: (value: T) => U) {
  const entries = Object.entries(record) as [K, T][];
  return Object.freeze(
    Object.fromEntries(entries.map(([key, value]) => [key, to(value)])),
  ) as Readonly<Record<K, U>>;
}

const F = FONT_FAMILIES;

const weights = (family: FontFamily, ...list: FontWeight[]) =>
  Object.freeze(list.map((weight) => spec(family, weight)));

/** Play's display faces, read from the vendored TYPE_STYLES (never retyped). */
const PLAY_DISPLAY = mapKeys(TYPE_STYLES, (type) => designFace(type.face, type.weight, type.style));

/** HUD's display faces, read from looks.json's options.font (hud-catalogue.ts). */
const HUD_DISPLAY = mapKeys(HUD_FONTS, (font) => designFace(font.family, font.weight, 'normal'));

/** Studio's faces: Newsreader titles with their italic emphasis, Geist and Geist Mono. */
const STUDIO_FACES = Object.freeze({
  display: Object.freeze({ serif: spec(F.newsreader, 500) }),
  emphasis: spec(F.newsreader, 500, 'italic'),
  body: weights(F.geist, 400, 500, 600),
  mono: weights(F.geistMono, 400, 500, 600),
});

export const STYLE_FACES = Object.freeze({
  studio: STUDIO_FACES,
  play: Object.freeze({
    display: PLAY_DISPLAY,
    body: weights(F.geist, 400, 500, 600),
    mono: weights(F.geistMono, 400, 500),
  }),
  hud: Object.freeze({
    display: HUD_DISPLAY,
    body: weights(F.geist, 400, 500, 600),
    mono: weights(F.geistMono, 400, 500, 600),
  }),
  arcade: Object.freeze({
    display: Object.freeze({ pixel: spec(F.pressStart2p, 400) }),
    body: weights(F.pixelifySans, 400, 600),
    mono: weights(F.geistMono, 400, 500, 600),
  }),
  candy: Object.freeze({
    display: Object.freeze({ title: spec(F.outfit, 600), figure: spec(F.outfit, 700) }),
    body: weights(F.nunito, 400, 700, 800),
    mono: weights(F.geistMono, 400, 500, 600),
  }),
} satisfies Readonly<Record<BuiltInStyleId, StyleFaceSet>>);

/** Play's display face for the look's font knob. */
export function playDisplayFace(font: TypeStyleKey): FaceSpec {
  return STYLE_FACES.play.display[font];
}

/** HUD's display face for the look's font knob. */
export function hudDisplayFace(font: HudFontKey): FaceSpec {
  return STYLE_FACES.hud.display[font];
}

/** Every face a style asks for, display, emphasis, body and mono. */
export function facesOf(set: StyleFaceSet): readonly FaceSpec[] {
  return [
    ...Object.values(set.display),
    ...(set.emphasis ? [set.emphasis] : []),
    ...set.body,
    ...set.mono,
  ];
}

/**
 * Of a style's faces for one role (its body or its mono), the one at this weight; else the
 * heaviest lighter one (Ember's Geist 700 → 600); else the lightest it has.
 */
export function pickFace(faces: readonly FaceSpec[], weight: FontWeight): FaceSpec {
  const byWeight = [...faces].sort((a, b) => a.weight - b.weight);
  const lighter = byWeight.filter((face) => face.weight <= weight);
  const picked = lighter.length > 0 ? lighter[lighter.length - 1] : byWeight[0];
  if (!picked) throw new Error('a style role with no faces');
  return picked;
}

/** The fontFamily React Native needs for a face: its PostScript name; throws if not bundled. */
export function faceFor(
  family: FontFamily,
  weight: FontWeight,
  style: FontStyle = 'normal',
): string {
  const face = fontFace(family, weight, style);
  if (!face) throw new Error(`${family} ${weight} ${style} is not bundled (fonts.ts)`);
  return face.postscriptName;
}
