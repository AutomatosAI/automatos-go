// What the phone keeps of an installed theme's phone painting (D58, D-NO-CODE): its colours in
// Studio's names, its tone, and its font and mascot files as allowlisted /api/themes/files/ URLs
// (file-url.ts). The URLs are kept, never a local path: the app's cache folder moves between app
// versions, so files.ts finds each file's copy from its URL when it is needed. Data only: no code,
// no layout. paint.ts builds it, cache.ts keeps it on the phone, resolve.ts paints it.

import type { ColourScheme, Colours } from '../tokens/types';
import type { ThemeFontRole } from './schemas';

export type ThemeMascotState = {
  readonly name: string;
  /** The state's .mp4 (mode 'clips'), or null. */
  readonly clip: string | null;
  /** The state's .png, or null. */
  readonly still: string | null;
};

/** A theme that brings Auto: US-017b's Mascot shows these instead of the bundled files. */
export type ThemeMascot = {
  readonly mode: 'clips' | 'stills';
  readonly states: readonly ThemeMascotState[];
};

export type ThemeFonts = Readonly<Partial<Record<ThemeFontRole, string>>>;

/**
 * An installed theme's phone painting (US-016i, from GET /api/themes/mobile/{install_id}): Studio's
 * colour names in each scheme (a scheme the theme leaves out holds the other's), the tone it fixes
 * (a 'fromLooks' theme) or null to follow Light / Dark / System, and whether it brings Auto.
 */
export type ThemePaint = {
  readonly installId: string;
  readonly colours: Readonly<Record<ColourScheme, Colours>>;
  readonly tone: ColourScheme | null;
  readonly mascot: boolean;
  /** The theme's font file for each role it sets; absent: Studio's faces. */
  readonly fonts?: ThemeFonts;
  /** The mascot's files when it brings one (mascot true); absent or null: none. */
  readonly mascotFiles?: ThemeMascot | null;
};

/** The font families loaded for a painting (fonts.ts): Studio's faces give way to these. */
export type LoadedThemeFonts = {
  readonly installId: string;
  readonly families: Readonly<Partial<Record<ThemeFontRole, string>>>;
};
