// What the phone can be painted as (PRD-001 §4.6, D54, D58): three built-in styles, each a layout
// built into the app plus a look, and the installed marketplace themes with a mobile block, which
// paint the Studio layout with their tokens, fonts and mascot (themes never bring a layout in v1).
// Pure types and helpers; choice.ts reads and writes a choice, registry.ts lists the styles.

export const BUILT_IN_STYLE_IDS = ['studio', 'play', 'hud'] as const;
export type BuiltInStyleId = (typeof BUILT_IN_STYLE_IDS)[number];

/** The layouts the app builds in; a style or a theme picks one, never brings one. */
export const LAYOUTS = ['studio', 'play', 'hud'] as const;
export type Layout = (typeof LAYOUTS)[number];

export type StyleChoice =
  | { readonly kind: 'builtin'; readonly id: BuiltInStyleId }
  | { readonly kind: 'theme'; readonly installId: string };

export function builtinChoice(id: BuiltInStyleId): StyleChoice {
  return Object.freeze({ kind: 'builtin', id });
}

export function themeChoice(installId: string): StyleChoice {
  return Object.freeze({ kind: 'theme', installId });
}

/** The layout a choice paints: a built-in style's own, and Studio's for a theme (D58). */
export function layoutOf(choice: StyleChoice): Layout {
  return choice.kind === 'theme' ? 'studio' : choice.id;
}

export function sameChoice(a: StyleChoice, b: StyleChoice): boolean {
  if (a.kind === 'builtin') return b.kind === 'builtin' && a.id === b.id;
  return b.kind === 'theme' && a.installId === b.installId;
}
