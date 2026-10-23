// Studio's type scale (handoff README 'Design Tokens' → Type, and tokens/typography.css): Newsreader
// 500 titles 28/23/21/15/14.5/14, Geist body 14/13.5/13/12.5/12/11.5, Geist Mono 600 uppercase
// labels and tabular figures 19/17/15. Each role is a React Native text style on an embedded face's
// PostScript name (fonts.ts), so no fontWeight or fontStyle is set: the face carries its weight and
// italic on iOS and Android alike (a style on top can make Android slant an italic file again).
// Sizes are points; tracking is the source's em times the size, as React Native's letterSpacing is
// in points.
//
// D38, 11 pt minimum: the handoff draws its mono labels at 9, 9.5, 10 and 10.5 px; here they are
// 11 (eyebrow, label). Nothing in the scale is below MIN_TEXT_SIZE, and __tests__/tokens.test.ts
// holds it there. Dynamic Type stays on: TEXT_SCALING keeps allowFontScaling true with no
// maxFontSizeMultiplier, so text grows to the accessibility sizes and layouts wrap (§4.6).

import { TYPE_FAMILIES, fontFace, type FontWeight } from './fonts';

/** D38: the smallest text on the phone, in points. */
export const MIN_TEXT_SIZE = 11;

/** Text props every Text primitive passes: Dynamic Type on, uncapped. */
export const TEXT_SCALING = Object.freeze({ allowFontScaling: true });

/** typography.css --leading-*: display, heading, body and lede (the thread's 14/1.55). */
export const LEADING = Object.freeze({ display: 1.05, heading: 1.15, body: 1.5, lede: 1.55 });

/** typography.css --tracking-* (em); figures take cc-stats' -0.02em. */
export const TRACKING = Object.freeze({
  display: -0.02,
  heading: -0.015,
  eyebrow: 0.1,
  label: 0.12,
  figure: -0.02,
});

export type TypeFamily = keyof typeof TYPE_FAMILIES;

export type TypeRole =
  | 'title1'
  | 'title2'
  | 'title3'
  | 'title4'
  | 'title5'
  | 'title6'
  | 'body1'
  | 'body2'
  | 'body3'
  | 'body4'
  | 'body5'
  | 'body6'
  | 'eyebrow'
  | 'label'
  | 'figure1'
  | 'figure2'
  | 'figure3';

export type TypeSpec = {
  readonly family: TypeFamily;
  readonly weight: FontWeight;
  readonly size: number;
  readonly leading: number;
  /** em */
  readonly tracking: number;
  readonly uppercase?: boolean;
  readonly tabular?: boolean;
};

/** A React Native text style, structurally its TextStyle. */
export type TypeStyle = {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly textTransform?: 'uppercase';
  readonly fontVariant?: 'tabular-nums'[];
};

export type TypeScale = Readonly<Record<TypeRole, TypeStyle>>;

const title = (
  size: number,
  leading: number = LEADING.heading,
  tracking: number = TRACKING.heading,
): TypeSpec => ({ family: 'serif', weight: 500, size, leading, tracking });
const body = (size: number, leading: number = LEADING.body): TypeSpec => ({
  family: 'sans',
  weight: 400,
  size,
  leading,
  tracking: 0,
});
const mono = (tracking: number): TypeSpec => ({
  family: 'mono',
  weight: 600,
  size: MIN_TEXT_SIZE,
  leading: LEADING.heading,
  tracking,
  uppercase: true,
});
const figure = (size: number): TypeSpec => ({
  family: 'mono',
  weight: 600,
  size,
  leading: LEADING.heading,
  tracking: TRACKING.figure,
  tabular: true,
});

/** The handoff's sizes by role; the comments name where the handoff uses each. */
export const TYPE_SPECS: Readonly<Record<TypeRole, TypeSpec>> = Object.freeze({
  title1: title(28, LEADING.display, TRACKING.display), // Command Centre h1 (cc-h1)
  title2: title(23), // ticket sheet title
  title3: title(21), // digest greeting
  title4: title(15), // mission draft and Deliverable titles
  title5: title(14.5), // board card title
  title6: title(14), // digest row label, roster names
  body1: body(14, LEADING.lede), // thread text, question text
  body2: body(13.5),
  body3: body(13), // lede and sub text
  body4: body(12.5), // tabs
  body5: body(12), // buttons and controls
  body6: body(11.5), // summaries and meta lines
  eyebrow: mono(TRACKING.eyebrow), // 'OPERATIONS · MON 19 OCT' (10.5 px in the handoff)
  label: mono(TRACKING.label), // header status, card meta, pip words (9-10 px in the handoff)
  figure1: figure(19), // glance counts
  figure2: figure(17),
  figure3: figure(15),
});

const DECIMALS_SCALE = 100;
const round = (value: number) => Math.round(value * DECIMALS_SCALE) / DECIMALS_SCALE;

export type TypeOverrides = { readonly weight?: FontWeight; readonly italic?: boolean };

/** A spec as a text style on its embedded face; throws for a face the app does not bundle. */
export function toTypeStyle(spec: TypeSpec, overrides: TypeOverrides = {}): TypeStyle {
  const weight = overrides.weight ?? spec.weight;
  const fontStyle = overrides.italic ? 'italic' : 'normal';
  const face = fontFace(TYPE_FAMILIES[spec.family], weight, fontStyle);
  if (!face) {
    throw new Error(
      `${TYPE_FAMILIES[spec.family]} ${weight} ${fontStyle} is not bundled (fonts.ts)`,
    );
  }
  return Object.freeze({
    fontFamily: face.postscriptName,
    fontSize: spec.size,
    lineHeight: round(spec.size * spec.leading),
    letterSpacing: round(spec.size * spec.tracking),
    ...(spec.uppercase ? { textTransform: 'uppercase' as const } : {}),
    ...(spec.tabular ? { fontVariant: ['tabular-nums' as const] } : {}),
  });
}

/** A role at another bundled weight or in italic (body at 500, 'Auto is working…' in italic). */
export function typeStyle(role: TypeRole, overrides: TypeOverrides = {}): TypeStyle {
  return toTypeStyle(TYPE_SPECS[role], overrides);
}

/** Studio's scale at each role's own weight. */
export const STUDIO_TYPE: TypeScale = Object.freeze(
  Object.fromEntries(
    Object.entries(TYPE_SPECS).map(([role, spec]) => [role, toTypeStyle(spec)]),
  ) as Record<TypeRole, TypeStyle>,
);
