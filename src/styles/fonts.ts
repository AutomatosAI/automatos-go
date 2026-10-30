// The twelve font families every style uses (PRD-001 §4.6, D57, K6; Press Start 2P and Pixelify
// Sans for Arcade, D-ARC-4; Outfit and Nunito for Candy, D-CAN-4). Each face is a static TTF in assets/fonts/<family>/, embedded natively by
// the expo-font config plugin (app.json lists every file), so no font is fetched or loaded at
// runtime. Each file is named after its PostScript name: iOS finds an embedded font by PostScript
// name and Android by file name, so `fontFamily: face.postscriptName` selects the same face on
// both. assets/fonts/SOURCES.md records where each file came from; __tests__/fonts.test.ts reads
// every TTF against this map.

export const FONT_FAMILIES = {
  geist: 'Geist',
  geistMono: 'Geist Mono',
  newsreader: 'Newsreader',
  instrumentSerif: 'Instrument Serif',
  bricolageGrotesque: 'Bricolage Grotesque',
  fredoka: 'Fredoka',
  rajdhani: 'Rajdhani',
  chakraPetch: 'Chakra Petch',
  pressStart2p: 'Press Start 2P',
  pixelifySans: 'Pixelify Sans',
  outfit: 'Outfit',
  nunito: 'Nunito',
} as const;

export type FontFamily = (typeof FONT_FAMILIES)[keyof typeof FONT_FAMILIES];
export type FontWeight = 400 | 500 | 600 | 700 | 800;
export type FontStyle = 'normal' | 'italic';

/** The families Studio's type scale uses (handoff tokens/typography.css --font-*). */
export const TYPE_FAMILIES = {
  serif: FONT_FAMILIES.newsreader,
  sans: FONT_FAMILIES.geist,
  mono: FONT_FAMILIES.geistMono,
} as const satisfies Record<string, FontFamily>;

export type FontFace = {
  readonly family: FontFamily;
  readonly weight: FontWeight;
  readonly style: FontStyle;
  /** nameID 6 of the TTF: the fontFamily value React Native needs for this face */
  readonly postscriptName: string;
  /** path under assets/fonts/ */
  readonly file: string;
};

export type FontFaceKey = `${FontFamily}|${FontWeight}|${FontStyle}`;

export function fontFaceKey(
  family: FontFamily,
  weight: FontWeight,
  style: FontStyle = 'normal',
): FontFaceKey {
  return `${family}|${weight}|${style}`;
}

function face(
  family: FontFamily,
  weight: FontWeight,
  style: FontStyle,
  dir: string,
  postscriptName: string,
): FontFace {
  return { family, weight, style, postscriptName, file: `${dir}/${postscriptName}.ttf` };
}

const F = FONT_FAMILIES;

const FACE_LIST: readonly FontFace[] = [
  face(F.geist, 400, 'normal', 'geist', 'Geist-Regular'),
  face(F.geist, 500, 'normal', 'geist', 'Geist-Medium'),
  face(F.geist, 600, 'normal', 'geist', 'Geist-SemiBold'),
  face(F.geistMono, 400, 'normal', 'geist-mono', 'GeistMono-Regular'),
  face(F.geistMono, 500, 'normal', 'geist-mono', 'GeistMono-Medium'),
  face(F.geistMono, 600, 'normal', 'geist-mono', 'GeistMono-SemiBold'),
  face(F.newsreader, 400, 'normal', 'newsreader', 'Newsreader16pt16pt-Regular'),
  face(F.newsreader, 500, 'normal', 'newsreader', 'Newsreader16pt16pt-Medium'),
  face(F.newsreader, 600, 'normal', 'newsreader', 'Newsreader16pt16pt-SemiBold'),
  face(F.newsreader, 400, 'italic', 'newsreader', 'Newsreader16pt16pt-Italic'),
  face(F.newsreader, 500, 'italic', 'newsreader', 'Newsreader16pt16pt-MediumItalic'),
  face(F.instrumentSerif, 400, 'normal', 'instrument-serif', 'InstrumentSerif-Regular'),
  face(F.instrumentSerif, 400, 'italic', 'instrument-serif', 'InstrumentSerif-Italic'),
  face(
    F.bricolageGrotesque,
    700,
    'normal',
    'bricolage-grotesque',
    'BricolageGrotesque96ptExtraBold-Bold',
  ),
  face(F.fredoka, 600, 'normal', 'fredoka', 'FredokaLight-SemiBold'),
  face(F.rajdhani, 500, 'normal', 'rajdhani', 'Rajdhani-Medium'),
  face(F.rajdhani, 600, 'normal', 'rajdhani', 'Rajdhani-SemiBold'),
  face(F.rajdhani, 700, 'normal', 'rajdhani', 'Rajdhani-Bold'),
  face(F.chakraPetch, 500, 'normal', 'chakra-petch', 'ChakraPetch-Medium'),
  face(F.chakraPetch, 600, 'normal', 'chakra-petch', 'ChakraPetch-SemiBold'),
  face(F.pressStart2p, 400, 'normal', 'press-start-2p', 'PressStart2P-Regular'),
  face(F.pixelifySans, 400, 'normal', 'pixelify-sans', 'PixelifySans-Regular'),
  face(F.pixelifySans, 600, 'normal', 'pixelify-sans', 'PixelifySans-SemiBold'),
  face(F.outfit, 600, 'normal', 'outfit', 'Outfit-SemiBold'),
  face(F.outfit, 700, 'normal', 'outfit', 'Outfit-Bold'),
  face(F.nunito, 400, 'normal', 'nunito', 'Nunito-Regular'),
  face(F.nunito, 700, 'normal', 'nunito', 'Nunito-Bold'),
  face(F.nunito, 800, 'normal', 'nunito', 'Nunito-ExtraBold'),
];

/** Every embedded face, keyed by family, weight and style. */
export const FONT_FACES: ReadonlyMap<FontFaceKey, FontFace> = new Map(
  FACE_LIST.map((item) => [fontFaceKey(item.family, item.weight, item.style), item]),
);

/** The embedded face for a family, weight and style, or undefined when none is bundled. */
export function fontFace(
  family: FontFamily,
  weight: FontWeight,
  style: FontStyle = 'normal',
): FontFace | undefined {
  return FONT_FACES.get(fontFaceKey(family, weight, style));
}
