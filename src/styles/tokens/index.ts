// The typed accessor: a style and a colour scheme to that style's tokens. Layouts get them through
// useTokens() (theme.tsx); A5 adds Play and HUD as entries here without changing the signature.

import { studioTokens } from './studio';
import type { ColourScheme, StyleId, Tokens } from './types';

const STYLES: Readonly<Record<StyleId, (scheme: ColourScheme) => Tokens>> = Object.freeze({
  studio: studioTokens,
});

export function tokensFor(style: StyleId, scheme: ColourScheme): Tokens {
  return STYLES[style](scheme);
}

export type {
  ColourName,
  ColourScheme,
  Colours,
  RadiusName,
  Radii,
  ShadowLayer,
  ShadowName,
  Shadows,
  SpaceName,
  Spacing,
  StyleId,
  Tokens,
} from './types';
