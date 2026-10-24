// Resolved styles for the dress tests: Studio Light and Dark, an installed theme's painting on the
// Studio layout, Play at every preset and every type knob, HUD at every preset and every font knob.

import { TYPE_STYLE_KEYS } from '../../../core/web/lib/looks/catalogue';
import { DAYLIGHT, EMBER, OBSIDIAN, PRESETS } from '../../../core/web/lib/looks/presets';
import { HUD_DEFAULT_LOOK, HUD_PRESET_LOOKS, type HudLook } from '../../hud/look-schema';
import { resolveStyle, type ResolvedStyle, type StyleInput } from '../../provider/resolve';
import { builtinChoice, themeChoice, type StyleChoice } from '../../registry/style-id';
import { HUD_FONT_KEYS } from '../../tokens/hud-catalogue';
import { playTokens } from '../../tokens/play';

const INSTALL_ID = '3f2b6c1e-9d4a-4b7e-8c21-5a6f0e9d1b42';

function input(choice: StyleChoice, overrides: Partial<StyleInput> = {}): StyleInput {
  return {
    choice,
    studioScheme: 'light',
    systemScheme: 'light',
    playLook: EMBER,
    hudLook: HUD_DEFAULT_LOOK,
    themePaint: null,
    reduceMotion: false,
    ...overrides,
  };
}

const resolve = (choice: StyleChoice, overrides: Partial<StyleInput> = {}) =>
  resolveStyle(input(choice, overrides));

export const STUDIO_LIGHT = resolve(builtinChoice('studio'));
export const STUDIO_DARK = resolve(builtinChoice('studio'), { studioScheme: 'dark' });

/** A theme on the Studio layout, painted with the look engine's colours (as US-016i makes them). */
export const THEMED = resolve(themeChoice(INSTALL_ID), {
  themePaint: {
    installId: INSTALL_ID,
    colours: { light: playTokens(DAYLIGHT), dark: playTokens(OBSIDIAN) },
    tone: null,
    mascot: false,
  },
});

export const STUDIO_STYLES: readonly ResolvedStyle[] = [STUDIO_LIGHT, STUDIO_DARK, THEMED];

export const PLAY_STYLES: readonly ResolvedStyle[] = [
  ...PRESETS.map((look) => resolve(builtinChoice('play'), { playLook: look })),
  ...TYPE_STYLE_KEYS.map((font) =>
    resolve(builtinChoice('play'), { playLook: { ...EMBER, font } }),
  ),
];

export const HUD_STYLES: readonly ResolvedStyle[] = [
  ...HUD_PRESET_LOOKS.map((look) => resolve(builtinChoice('hud'), { hudLook: look })),
  ...HUD_FONT_KEYS.map((font) =>
    resolve(builtinChoice('hud'), { hudLook: { ...HUD_DEFAULT_LOOK, font } as HudLook }),
  ),
];

export const PLAY = PLAY_STYLES[0];
export const HUD = HUD_STYLES[0];

export const ALL_STYLES: readonly ResolvedStyle[] = [
  ...STUDIO_STYLES,
  ...PLAY_STYLES,
  ...HUD_STYLES,
];
