// A5's own app routes (KS4): the Style and look screen and the two look pages. They live here, not
// in src/navigation/routes.ts, which the connect kit edits in parallel; the idiom is that file's —
// expo-router's typed routes stay off, so a route is a plain string and each screen file sits at
// exactly its path. Every other destination uses the foundation's routes. Pure: no React, no
// expo-router, so vitest loads it.

import type { LookPage } from './registry/registry';

export const STYLE_SCREENS = Object.freeze({
  /** The style picker, Settings → Style and look: app/(app)/settings/style.tsx (US-016h). */
  settingsStyle: '/settings/style',
  /** Play's 'Make it yours': app/(app)/settings/look/play.tsx (US-017e). */
  lookPlay: '/settings/look/play',
  /** HUD's Looks drawer: app/(app)/settings/look/hud.tsx (US-018c). */
  lookHud: '/settings/look/hud',
} as const);

export type StyleScreen = keyof typeof STYLE_SCREENS;

/** One of A5's paths, as router.push and router.replace take it. */
export type StyleScreenPath = (typeof STYLE_SCREENS)[StyleScreen];

const LOOK_SCREENS: Readonly<Record<LookPage, StyleScreenPath | null>> = Object.freeze({
  // Studio's look is Light / Dark / System, on its own card in the picker
  scheme: null,
  play: STYLE_SCREENS.lookPlay,
  hud: STYLE_SCREENS.lookHud,
});

/** The look page a style's card links to; null for Studio. */
export function lookScreen(page: LookPage): StyleScreenPath | null {
  return LOOK_SCREENS[page];
}
