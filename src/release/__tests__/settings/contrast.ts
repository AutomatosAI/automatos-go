// The contrast test's settings (src/styles/__tests__/contrast.test.ts, rule 10.4): the palettes it
// measures, every text colour of the token shape with the grounds the primitives draw it on, and
// the pairs that read under AA today, each with what it measures and why it stands. An app that
// adds a palette, or a role beside the shared ones (rule 1.2), names it here.

import type { TextOnGrounds } from '../../../styles/contrast';
import { STYLE_IDS, tokensFor, type Tokens } from '../../../styles/tokens';
import { frozen } from './types';

const SCHEMES = ['light', 'dark'] as const;

/** Every built-in palette once: a style that ignores the scheme gives one set, Studio two. */
export const CONTRAST_PALETTES: readonly Tokens[] = Object.freeze([
  ...new Set(STYLE_IDS.flatMap((style) => SCHEMES.map((scheme) => tokensFor(style, scheme)))),
]);

/** Each text colour and the grounds the primitives draw it on (src/ui/variants.ts TEXT_TONES). */
export const TEXT_ON: readonly TextOnGrounds[] = frozen([
  ['foreground', ['background', 'card', 'secondary', 'muted']],
  ['mutedForeground', ['background', 'card', 'secondary', 'muted']],
  ['fg2', ['background', 'card']],
  ['fg3', ['background', 'card']],
  ['cardForeground', ['card']],
  ['popoverForeground', ['popover']],
  ['secondaryForeground', ['secondary']],
  ['primaryForeground', ['primary']],
  ['accentForeground', ['accent']],
  ['destructiveForeground', ['destructive']],
  ['successForeground', ['success']],
  ['infoForeground', ['info']],
  ['warningForeground', ['warning']],
  ['accent', ['background', 'card']],
  ['olive', ['background', 'card']],
  ['navy', ['background', 'card']],
  ['warnInk', ['background', 'card']],
  ['destructive', ['background', 'card']],
]);

export type Known = { readonly pair: string; readonly ratio: number; readonly why: string };

// Studio's values are core's own (src/styles/tokens/studio-source.ts is copied, never retuned),
// and the web paints the same ones: each of these closes when core's token moves, not by a change
// here.
const STUDIO_IS_CORES = "Studio Light's value is core's token, copied and never retuned here";
export const KNOWN: readonly Known[] = frozen([
  { pair: 'studio light: mutedForeground on muted', ratio: 4.2, why: STUDIO_IS_CORES },
  { pair: 'studio light: fg3 on background', ratio: 3.25, why: STUDIO_IS_CORES },
  { pair: 'studio light: fg3 on card', ratio: 3.77, why: STUDIO_IS_CORES },
  { pair: 'studio light: accent on background', ratio: 4.23, why: STUDIO_IS_CORES },
  { pair: 'studio light: destructive on background', ratio: 4.23, why: STUDIO_IS_CORES },
]);
