// The ring per style and state (D-MASCOT, D-ONE-VOICE, D60): Play by the vendored Ember rule, HUD
// from its look and catalogue, Studio and themes in ink and orange from the Studio-keyed tokens.

import { describe, expect, it } from 'vitest';

import { mixHex } from '../../../core/web/lib/look-kit/contrast';
import { DUSK_TOWARD_BG } from '../../../core/web/lib/look-kit/css';
import { ACCENTS, ERROR_COLOUR, GROUNDS, LIGHTS } from '../../../core/web/lib/looks/catalogue';
import { duskOf } from '../../../core/web/lib/looks/engine';
import { EMBER, PRESETS } from '../../../core/web/lib/looks/presets';
import { ringColour, ringTone, type RingTone } from '../../../core/web/lib/mascot/ring';
import { MASCOT_STATES, type MascotName } from '../../../core/web/lib/mascot/types';
import { HUD_DEFAULT_LOOK, HUD_PRESET_LOOKS } from '../../hud/look-schema';
import { resolveStyle, type StyleInput } from '../../provider/resolve';
import { builtinChoice, type StyleChoice } from '../../registry/style-id';
import { HUD_ACCENTS, HUD_FIXED, HUD_GROUNDS } from '../../tokens/hud-catalogue';
import { studioTokens } from '../../tokens/studio';
import type { Colours } from '../../tokens/types';
import { hudRingPalette, ringColourOf, studioRingPalette, type RingStyle } from '../ring-palette';

function style(choice: StyleChoice, overrides: Partial<StyleInput> = {}): RingStyle {
  return resolveStyle({
    choice,
    studioScheme: 'light',
    systemScheme: 'light',
    playLook: EMBER,
    hudLook: HUD_DEFAULT_LOOK,
    themePaint: null,
    reduceMotion: false,
    ...overrides,
  });
}

const STATE_OF_TONE: Readonly<Record<RingTone, MascotName>> = {
  light: 'idle',
  accent: 'working',
  error: 'oops',
  dusk: 'sleeping',
  quiet: 'loading',
};

describe('Play', () => {
  it.each(PRESETS.map((look) => [look.id, look] as const))(
    '%s paints every state by the vendored ringColour',
    (_, look) => {
      const play = style(builtinChoice('play'), { playLook: look });
      for (const state of MASCOT_STATES)
        expect(ringColourOf(state, play)).toBe(ringColour(state, look));
    },
  );

  it('Ember: mint calm, molten busy, coral for oops, dusk asleep, the ground’s text2 loading', () => {
    const play = style(builtinChoice('play'));
    expect(ringColourOf('idle', play)).toBe(LIGHTS.mint.hex);
    expect(ringColourOf('thinking', play)).toBe(ACCENTS.molten.hex);
    expect(ringColourOf('oops', play)).toBe(ERROR_COLOUR);
    expect(ringColourOf('lost', play)).toBe(duskOf('graphite'));
    expect(ringColourOf('loading', play)).toBe(GROUNDS.graphite.text2);
  });
});

describe('HUD', () => {
  it.each(HUD_PRESET_LOOKS.map((look) => [look.id, look] as const))(
    '%s: light and busy in the accent, the fixed error, dusk from the ground, text2 loading',
    (_, look) => {
      const accent = HUD_ACCENTS[look.accent].hex;
      expect(hudRingPalette(look)).toEqual({
        light: accent,
        accent,
        error: HUD_FIXED.error,
        dusk: mixHex(HUD_FIXED.text2, HUD_GROUNDS[look.ground].bg, DUSK_TOWARD_BG),
        quiet: HUD_FIXED.text2,
      });
      const hud = style(builtinChoice('hud'), { hudLook: look });
      for (const state of MASCOT_STATES) {
        expect(ringColourOf(state, hud)).toBe(hudRingPalette(look)[ringTone(state)]);
      }
    },
  );
});

describe('Studio and themes', () => {
  it.each(['light', 'dark'] as const)(
    'Studio %s: ink calm, orange busy, destructive, muted',
    (scheme) => {
      const studio = style(builtinChoice('studio'), { studioScheme: scheme });
      const { colours } = studioTokens(scheme);
      const expected: Readonly<Record<RingTone, string>> = {
        light: colours.foreground,
        accent: colours.accent,
        error: colours.destructive,
        dusk: colours.mutedForeground,
        quiet: colours.mutedForeground,
      };
      for (const [tone, state] of Object.entries(STATE_OF_TONE)) {
        expect(ringColourOf(state, studio)).toBe(expected[tone as RingTone]);
      }
    },
  );

  it('a theme paints with its own Studio-keyed colours', () => {
    const base = studioTokens('light');
    // any two colours other than Studio's stand for the theme's (no literal outside the tokens)
    const ink = HUD_FIXED.text;
    const accent = HUD_ACCENTS.forge.hex;
    const colours: Colours = { ...base.colours, foreground: ink, accent };
    const themed: RingStyle = { layout: 'studio', tokens: { ...base, colours } };
    expect(ringColourOf('idle', themed)).toBe(ink);
    expect(ringColourOf('searching', themed)).toBe(accent);
    expect(studioRingPalette(colours).error).toBe(base.colours.destructive);
  });

  it('a Play or HUD layout without its look falls back to the Studio-keyed tokens', () => {
    const base = studioTokens('dark');
    expect(ringColourOf('idle', { layout: 'play', tokens: base })).toBe(base.colours.foreground);
    expect(ringColourOf('working', { layout: 'hud', tokens: base })).toBe(base.colours.accent);
  });
});
