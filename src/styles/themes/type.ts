// An installed theme's fonts on the Studio layout (D58, D-FONTS: an installed theme's fonts are
// data files it lists). Pure. A theme brings at most one face per role (sans, serif, mono: one
// sfnt file each, services/themes/package.py), loaded by fonts.ts under 'theme-<installId>-<role>'.
// While the theme is the style, every Studio text style whose face is Geist (sans), Newsreader
// (serif) or Geist Mono (mono) takes the theme's family for that role, at every weight (the theme
// has one face); sizes, leading, tracking and the 11 pt floor stay Studio's. A role the theme does
// not load keeps Studio's face. Each themed set is built once per (scale, families) pair, so a
// screen's memoised styles hold until the fonts change.

import { FONT_FACES, TYPE_FAMILIES, type FontFamily } from '../fonts';
import type { TypeRole, TypeScale, TypeStyle } from '../type';
import type { Tokens } from '../tokens/types';
import type { StyleType } from '../typeface/types';
import type { ThemeFontRole } from './schemas';
import type { LoadedThemeFonts } from './types';

export type ThemeFamilies = LoadedThemeFonts['families'];

/** The family a theme's font is loaded under: 'theme-<installId>-<role>'. */
export function themeFontFamily(installId: string, role: ThemeFontRole): string {
  return `theme-${installId}-${role}`;
}

const ROLE_OF_FAMILY: ReadonlyMap<FontFamily, ThemeFontRole> = new Map<FontFamily, ThemeFontRole>([
  [TYPE_FAMILIES.sans, 'sans'],
  [TYPE_FAMILIES.serif, 'serif'],
  [TYPE_FAMILIES.mono, 'mono'],
]);

/** Studio's embedded faces by PostScript name (the fontFamily a text style carries) → role. */
const ROLE_OF_FACE: ReadonlyMap<string, ThemeFontRole> = new Map(
  [...FONT_FACES.values()].flatMap((face) => {
    const role = ROLE_OF_FAMILY.get(face.family);
    return role ? [[face.postscriptName, role] as const] : [];
  }),
);

/** build(a, b), once per pair of objects. */
function oncePerPair<A extends object, B extends object, V>(build: (a: A, b: B) => V) {
  const built = new WeakMap<A, WeakMap<B, V>>();
  return (a: A, b: B): V => {
    const inner = built.get(a) ?? new WeakMap<B, V>();
    const found = inner.get(b);
    if (found !== undefined) return found;
    const value = build(a, b);
    built.set(a, inner.set(b, value));
    return value;
  };
}

/** The style in the theme's family for its role, or the style itself when the theme has none. */
export const themedStyle = oncePerPair((style: TypeStyle, families: ThemeFamilies): TypeStyle => {
  const role = ROLE_OF_FACE.get(style.fontFamily);
  const family = role ? families[role] : undefined;
  return family ? Object.freeze({ ...style, fontFamily: family }) : style;
});

/** The foundation's scale (useTokens().type) with the theme's families. */
export const themedTypeScale = oncePerPair((scale: TypeScale, families: ThemeFamilies): TypeScale =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(scale).map(([role, style]) => [role, themedStyle(style, families)]),
    ) as Record<TypeRole, TypeStyle>,
  ),
);

/** The Studio-keyed token set with the themed scale. */
export const themedTokens = oncePerPair((tokens: Tokens, families: ThemeFamilies): Tokens =>
  Object.freeze({ ...tokens, type: themedTypeScale(tokens.type, families) }),
);

/** A style's type (useStyle().type) with the theme's families. */
export const themedStyleType = oncePerPair(
  (type: StyleType, families: ThemeFamilies): StyleType => {
    const swap = (style: TypeStyle) => themedStyle(style, families);
    return Object.freeze({
      title: (role) => swap(type.title(role)),
      display: (slot) => swap(type.display(slot)),
      body: (size, weight, options) => swap(type.body(size, weight, options)),
      mono: (size, weight, options) => swap(type.mono(size, weight, options)),
      label: swap(type.label),
      eyebrow: swap(type.eyebrow),
      button: swap(type.button),
    });
  },
);
