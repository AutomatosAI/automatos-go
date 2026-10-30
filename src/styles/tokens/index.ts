// The typed accessor: a style and a colour scheme to that style's tokens. Layouts get them through
// useTokens() (theme.tsx); A5 adds Play and HUD, A8 Arcade, as entries here without changing the
// signature. Play and HUD paint their look's own tone whatever the scheme (as on the web), so here
// they are their default looks (Ember, ARC); the phone's chosen look reaches a screen through
// useTokens() (src/styles/provider/resolve.ts).

import { DEFAULT_LOOK } from '../../core/frozen/lib/looks/presets';
import { HUD_DEFAULT_PRESET_ID, HUD_PRESETS } from './hud-catalogue';
import { studioTokens } from './studio';
import { hudStyleTokens, oncePerObject, playStyleTokens } from './style-tokens';
import type { ColourScheme, StyleId, Tokens } from './types';

function hudDefaultPreset() {
  const found = HUD_PRESETS.find((preset) => preset.id === HUD_DEFAULT_PRESET_ID);
  if (!found) throw new Error(`looks.json has no preset ${HUD_DEFAULT_PRESET_ID}`);
  return found;
}

const HUD_DEFAULT_PRESET = hudDefaultPreset();

/** Studio's set under Arcade's name, once per Studio set, until Arcade's palettes land. */
// ARCADE_STAND_IN US-022b
const arcadeStandIn = oncePerObject((studio: Tokens): Tokens =>
  Object.freeze({ ...studio, style: 'arcade' }),
);

const STYLES: Readonly<Record<StyleId, (scheme: ColourScheme) => Tokens>> = Object.freeze({
  studio: studioTokens,
  play: () => playStyleTokens(DEFAULT_LOOK),
  hud: () => hudStyleTokens(HUD_DEFAULT_PRESET),
  arcade: (scheme) => arcadeStandIn(studioTokens(scheme)), // ARCADE_STAND_IN US-022b
});

/** Every built-in style, so a check over the looks (the AI label's contrast) covers a new one. */
export const STYLE_IDS: readonly StyleId[] = Object.freeze(Object.keys(STYLES) as StyleId[]);

export function tokensFor(style: StyleId, scheme: ColourScheme): Tokens {
  return STYLES[style](scheme);
}

export { hudStyleTokens, paintedStudioTokens, playStyleTokens } from './style-tokens';
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
  ThreadPaint,
  Tokens,
} from './types';
