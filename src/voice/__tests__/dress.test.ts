// The voice screen's dress (US-019i, KV9, D-ONE-VOICE) over styles resolved by A5's own
// resolveStyle, never hand-written colours: Studio light and dark (ink structure, orange motion),
// Play (its look's accent, Auto in the core), HUD with Auto on and off (its accent, its overlay),
// Arcade in every preset (its palette's accent, the core filled with its window, Auto as its
// sprite, US-022i), an installed theme with and without a mascot, and Reduce Motion. Every colour
// equals the resolved style's own.

import { describe, expect, it } from 'vitest';

import { DAYLIGHT, EMBER, OBSIDIAN, PRESETS } from '../../core/frozen/lib/looks/presets';
import { ARCADE_PRESET_LOOKS } from '../../styles/arcade/look-schema';
import { HUD_DEFAULT_LOOK, HUD_PRESET_LOOKS, type HudLook } from '../../styles/hud/look-schema';
import { resolveStyle, type ResolvedStyle, type StyleInput } from '../../styles/provider/resolve';
import { builtinChoice, themeChoice, type StyleChoice } from '../../styles/registry/style-id';
import { playTokens } from '../../styles/tokens/play';
import { clearOf, voicePaint } from '../../styles/tokens/voice-colours';
import { voiceDress, type VoiceDress } from '../screen/dress';

const INSTALL_ID = '6a1f3c2e-8b7d-4e5f-9a0b-1c2d3e4f5a6b';

function resolve(choice: StyleChoice, overrides: Partial<StyleInput> = {}): ResolvedStyle {
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

const studio = builtinChoice('studio');
const play = builtinChoice('play');
const hud = builtinChoice('hud');
const arcade = builtinChoice('arcade');
const theme = themeChoice(INSTALL_ID);

/** A theme's painting as US-016i caches it, its colours from the vendored look engine. */
function painted(mascot: boolean): Partial<StyleInput> {
  return {
    themePaint: {
      installId: INSTALL_ID,
      colours: { light: playTokens(DAYLIGHT), dark: playTokens(OBSIDIAN) },
      tone: null,
      mascot,
    },
  };
}

const hudLook = (changes: Partial<HudLook>): HudLook => ({ ...HUD_DEFAULT_LOOK, ...changes });

const STUDIO_LIGHT = resolve(studio);
const STUDIO_DARK = resolve(studio, { studioScheme: 'dark' });
const PLAY = resolve(play);
const HUD_AUTO_ON = resolve(hud, { hudLook: hudLook({ auto: 'on' }) });
const HUD_AUTO_OFF = resolve(hud, { hudLook: hudLook({ auto: 'off' }) });
const THEME_WITH_MASCOT = resolve(theme, painted(true));
const THEME_WITHOUT = resolve(theme, painted(false));
const ARCADE_STYLES = ARCADE_PRESET_LOOKS.map((look) => resolve(arcade, { arcadeLook: look }));

const STYLES: readonly ResolvedStyle[] = [
  STUDIO_LIGHT,
  STUDIO_DARK,
  PLAY,
  ...PRESETS.map((look) => resolve(play, { playLook: look })),
  HUD_AUTO_ON,
  HUD_AUTO_OFF,
  ...HUD_PRESET_LOOKS.map((look) => resolve(hud, { hudLook: look })),
  ...ARCADE_STYLES,
  THEME_WITH_MASCOT,
  THEME_WITHOUT,
  resolve(theme),
];

const accentOnly = (dress: VoiceDress) => [
  dress.ringAccent,
  dress.waveform,
  dress.chipText,
  dress.cursor,
];

describe('Studio: ink and orange (KV9)', () => {
  it.each([
    ['light', STUDIO_LIGHT],
    ['dark', STUDIO_DARK],
  ])('%s: structure in --foreground, motion in --accent, no overlay or Auto', (_, style) => {
    const dress = voiceDress(style);
    const { colours } = style.tokens;
    expect(dress.ringLine).toBe(colours.foreground);
    expect(accentOnly(dress)).toEqual(Array(4).fill(colours.accent));
    expect(dress.chipLine).toBe(voicePaint(style).accentLine);
    expect(dress).toMatchObject({ overlay: false, mascotInCore: false, motion: true });
    expect(dress.ringLine).not.toBe(dress.ringAccent);
  });

  it('follows the scheme: the dark ink is not the light one', () => {
    expect(voiceDress(STUDIO_DARK).ringLine).not.toBe(voiceDress(STUDIO_LIGHT).ringLine);
  });
});

describe('an installed theme (the Studio layout)', () => {
  it("paints with the theme's own foreground and accent", () => {
    [THEME_WITH_MASCOT, THEME_WITHOUT].forEach((style) => {
      const dress = voiceDress(style);
      expect(dress.ringLine).toBe(style.tokens.colours.foreground);
      expect(dress.ringAccent).toBe(style.tokens.colours.accent);
      expect(dress.overlay).toBe(false);
    });
    expect(voiceDress(THEME_WITH_MASCOT).ringAccent).not.toBe(voiceDress(STUDIO_LIGHT).ringAccent);
  });

  it('Auto sits in the core only when the theme brings a mascot', () => {
    expect(THEME_WITH_MASCOT.mascot).toBe('theme');
    expect(voiceDress(THEME_WITH_MASCOT).mascotInCore).toBe(true);
    expect(voiceDress(THEME_WITHOUT).mascotInCore).toBe(false);
    expect(voiceDress(resolve(theme)).mascotInCore).toBe(false);
  });
});

describe('Play: the look’s accent, Auto in the centre', () => {
  it('every preset: the accent for both rings, its line for the chip, Auto always', () => {
    STYLES.filter((style) => style.layout === 'play').forEach((style) => {
      const accent = style.play?.accent;
      const dress = voiceDress(style);
      expect(accent).toBeDefined();
      expect(dress.ringLine).toBe(accent);
      expect(accentOnly(dress)).toEqual(Array(4).fill(accent));
      expect(dress.chipLine).toBe(style.play?.accentLine);
      expect(dress).toMatchObject({ overlay: false, mascotInCore: true });
    });
  });
});

describe('HUD: its accent, its overlay, Auto by the look', () => {
  it('every preset: hud.accent for both rings, its line for the chip, the overlay on', () => {
    STYLES.filter((style) => style.layout === 'hud').forEach((style) => {
      const accent = style.hud?.accent;
      const dress = voiceDress(style);
      expect(accent).toBeDefined();
      expect(dress.ringLine).toBe(accent);
      expect(accentOnly(dress)).toEqual(Array(4).fill(accent));
      expect(dress.chipLine).toBe(style.hud?.accentLine);
      expect(dress.overlay).toBe(true);
      expect(dress.mascotInCore).toBe(style.hudLook?.auto === 'on');
    });
  });

  it("Auto in the core with the look's auto on, not with it off", () => {
    expect(voiceDress(HUD_AUTO_ON).mascotInCore).toBe(true);
    expect(voiceDress(HUD_AUTO_OFF).mascotInCore).toBe(false);
  });
});

describe('Arcade: the palette’s accent, its window in the core, Auto as the sprite', () => {
  it('every preset: ac for both rings and the chip, the core in win, no HUD overlay', () => {
    expect(ARCADE_STYLES).toHaveLength(5);
    ARCADE_STYLES.forEach((style) => {
      const vars = style.arcade;
      const dress = voiceDress(style);
      expect(vars).toBeDefined();
      expect(dress.ringLine).toBe(vars?.ac);
      expect(accentOnly(dress)).toEqual(Array(4).fill(vars?.ac));
      expect(dress.chipLine).toBe(voicePaint(style).accentLine);
      expect(dress.coreFill).toBe(vars?.win);
      expect(dress).toMatchObject({ overlay: false, mascotInCore: true, sprite: true });
    });
  });

  it('puts the sprite in the core in place of the bundled mascot, which Arcade never shows', () => {
    const style = ARCADE_STYLES[0];
    expect(style.mascot).toBe('none');
    expect(voiceDress(style).mascotInCore).toBe(true);
    expect(voiceDress(style).sprite).toBe(true);
  });

  it('is the only style that fills the core or draws the sprite', () => {
    STYLES.filter((style) => style.layout !== 'arcade').forEach((style) => {
      const dress = voiceDress(style);
      expect(dress.sprite).toBe(false);
      expect(dress.coreFill).toBe(clearOf(voicePaint(style).accent));
      expect(dress.coreFill).toMatch(/,0\)$/);
    });
  });
});

describe('motion', () => {
  it('Reduce Motion stills every style; HUD’s motion off stills HUD', () => {
    const choices = [studio, play, hud, arcade, theme];
    choices.forEach((choice) => {
      expect(voiceDress(resolve(choice)).motion).toBe(true);
      expect(voiceDress(resolve(choice, { reduceMotion: true })).motion).toBe(false);
    });
    const still = resolve(hud, { hudLook: hudLook({ motion: 'off' }) });
    expect(voiceDress(still).motion).toBe(false);
    expect(voiceDress(still).motion).toBe(still.motion.loops);
  });
});

describe('no colour of its own (D-TOKENS)', () => {
  it("every colour in every dress is one of the resolved style's", () => {
    STYLES.forEach((style) => {
      const own = new Set<string>([
        ...Object.values(style.tokens.colours),
        ...Object.values(style.play ?? {}),
        ...Object.values(style.hud ?? {}),
        ...Object.values(style.arcade ?? {}),
        // Candy's gradient is a list of colours: each one counts
        ...Object.values(voicePaint(style)).flat(),
      ]);
      const dress = voiceDress(style);
      const colours = [dress.ringLine, ...accentOnly(dress), dress.chipLine, dress.coreFill];
      colours.forEach((colour) => expect(own.has(colour)).toBe(true));
      expect(Object.isFrozen(dress)).toBe(true);
    });
  });
});
