// resolveStyle (PRD-001 §4.6, D54, D58, D59): Studio by Light / Dark / System and the phone's
// appearance; Play by its look's ground whatever the scheme; HUD always dark; a theme choice on the
// Studio layout with its cached painting, or Studio's own while none is; the motion rules
// (Reduce Motion, HUD's motion knob); where Auto comes from; StyleScope's input.

import { describe, expect, it } from 'vitest';

import { DAYLIGHT, EMBER, OBSIDIAN, PRESETS } from '../../../core/frozen/lib/looks/presets';
import { HUD_DEFAULT_LOOK, HUD_PRESET_LOOKS, type HudLook } from '../../hud/look-schema';
import { builtinChoice, themeChoice, type StyleChoice } from '../../registry/style-id';
import { THEME_CHOICES, type SystemScheme } from '../../theme-choice';
import { hudTokens, hudVars } from '../../tokens/hud';
import { playTokens, playVars } from '../../tokens/play';
import { STYLE_RADII } from '../../tokens/radii';
import { studioTokens } from '../../tokens/studio';
import { hudStyleTokens, playStyleTokens } from '../../tokens/style-tokens';
import type { ColourScheme } from '../../tokens/types';
import { styleType } from '../../typeface/scale';
import {
  bundledMascot,
  motionOf,
  resolveStyle,
  scopeInput,
  type StyleInput,
  type ThemePaint,
} from '../resolve';

const STUDIO = builtinChoice('studio');
const PLAY = builtinChoice('play');
const HUD = builtinChoice('hud');
const INSTALL_ID = '3f2b6c1e-9d4a-4b7e-8c21-5a6f0e9d1b42';
const THEME = themeChoice(INSTALL_ID);

const SYSTEM_SCHEMES: readonly SystemScheme[] = ['light', 'dark', null, undefined];
const SCHEME_GRID = THEME_CHOICES.flatMap((studioScheme) =>
  SYSTEM_SCHEMES.map((systemScheme) => [studioScheme, systemScheme] as const),
);

const GHOST = HUD_PRESET_LOOKS.find((look) => look.id === 'ghost') as HudLook;
const HUD_STILL: HudLook = Object.freeze({ ...HUD_DEFAULT_LOOK, motion: 'off' });

function input(choice: StyleChoice, overrides: Partial<StyleInput> = {}): StyleInput {
  return Object.freeze({
    choice,
    studioScheme: 'system',
    systemScheme: 'light',
    playLook: EMBER,
    hudLook: HUD_DEFAULT_LOOK,
    themePaint: null,
    reduceMotion: false,
    ...overrides,
  });
}

/** What Studio's System, Light and Dark paint on a phone in this appearance. */
function expectedScheme(studioScheme: string, system: SystemScheme): ColourScheme {
  if (studioScheme === 'light' || studioScheme === 'dark') return studioScheme;
  return system === 'dark' ? 'dark' : 'light';
}

/** A painting in light and dark (Studio-keyed colours from the look engine, as US-016i makes). */
function painting(overrides: Partial<ThemePaint> = {}): ThemePaint {
  return Object.freeze({
    installId: INSTALL_ID,
    colours: Object.freeze({ light: playTokens(DAYLIGHT), dark: playTokens(OBSIDIAN) }),
    tone: null,
    mascot: false,
    ...overrides,
  });
}

describe('Studio follows Light / Dark / System (D59)', () => {
  it.each(SCHEME_GRID)('Studio %s on a %s phone', (studioScheme, systemScheme) => {
    const scheme = expectedScheme(studioScheme, systemScheme);
    const style = resolveStyle(input(STUDIO, { studioScheme, systemScheme }));
    expect(style.layout).toBe('studio');
    expect(style.tone).toBe(scheme);
    expect(style.tokens).toBe(studioTokens(scheme));
    expect(style.radii).toBe(STYLE_RADII.studio);
    expect(style.type).toBe(styleType({ layout: 'studio' }));
    expect(style.mascot).toBe('none');
    expect(style).not.toHaveProperty('play');
    expect(style).not.toHaveProperty('hud');
  });

  it('keeps the choice it was given and freezes what it returns', () => {
    const style = resolveStyle(input(STUDIO));
    expect(style.choice).toBe(STUDIO);
    expect(Object.isFrozen(style)).toBe(true);
  });
});

describe('Play paints its look, whatever the scheme says', () => {
  it.each(SCHEME_GRID)(
    'Ember is dark under Studio %s on a %s phone',
    (studioScheme, systemScheme) => {
      const style = resolveStyle(input(PLAY, { studioScheme, systemScheme }));
      expect(style.layout).toBe('play');
      expect(style.tone).toBe('dark');
      expect(style.tokens).toBe(playStyleTokens(EMBER));
      expect(style.tokens.scheme).toBe('dark');
    },
  );

  it.each(SCHEME_GRID)(
    'Daylight is light under Studio %s on a %s phone',
    (studioScheme, systemScheme) => {
      const style = resolveStyle(input(PLAY, { studioScheme, systemScheme, playLook: DAYLIGHT }));
      expect(style.tone).toBe('light');
      expect(style.tokens.colours).toEqual(playTokens(DAYLIGHT));
    },
  );

  it.each(PRESETS)(
    '$name carries its look, its variables, its radii, its type and Auto',
    (look) => {
      const style = resolveStyle(input(PLAY, { playLook: look }));
      expect(style.playLook).toBe(look);
      expect(style.play).toEqual(playVars(look));
      expect(style.radii).toBe(STYLE_RADII.play);
      expect(style.type).toBe(styleType({ layout: 'play', font: look.font }));
      expect(style.mascot).toBe('bundled');
      expect(style).not.toHaveProperty('hud');
    },
  );

  it('hands back the same tokens and variables for the same look object', () => {
    const first = resolveStyle(input(PLAY));
    const second = resolveStyle(input(PLAY, { studioScheme: 'dark', reduceMotion: true }));
    expect(second.tokens).toBe(first.tokens);
    expect(second.play).toBe(first.play);
  });
});

describe('HUD is always dark', () => {
  it.each(SCHEME_GRID)('ARC under Studio %s on a %s phone', (studioScheme, systemScheme) => {
    const style = resolveStyle(input(HUD, { studioScheme, systemScheme }));
    expect(style.layout).toBe('hud');
    expect(style.tone).toBe('dark');
    expect(style.tokens.scheme).toBe('dark');
    expect(style.tokens).toBe(hudStyleTokens(HUD_DEFAULT_LOOK));
  });

  it.each(HUD_PRESET_LOOKS)(
    '$name carries its look, its variables, square radii and its type',
    (look) => {
      const style = resolveStyle(input(HUD, { hudLook: look, studioScheme: 'light' }));
      expect(style.hudLook).toBe(look);
      expect(style.hud).toEqual(hudVars(look));
      expect(style.tokens.colours).toEqual(hudTokens(look));
      expect(style.radii).toBe(STYLE_RADII.hud);
      expect(style.type).toBe(styleType({ layout: 'hud', font: look.font }));
      expect(style).not.toHaveProperty('play');
    },
  );

  it("shows Auto only when the look's auto knob is on", () => {
    expect(resolveStyle(input(HUD)).mascot).toBe('bundled');
    expect(GHOST.auto).toBe('off');
    expect(resolveStyle(input(HUD, { hudLook: GHOST })).mascot).toBe('none');
    expect(bundledMascot('studio', HUD_DEFAULT_LOOK)).toBe('none');
    expect(bundledMascot('play', GHOST)).toBe('bundled');
  });
});

describe('an installed theme paints the Studio layout (D58)', () => {
  it.each(SCHEME_GRID)(
    "is Studio's own under %s on a %s phone while no painting is cached",
    (studioScheme, systemScheme) => {
      const scheme = expectedScheme(studioScheme, systemScheme);
      const style = resolveStyle(input(THEME, { studioScheme, systemScheme }));
      expect(style.layout).toBe('studio');
      expect(style.tokens).toBe(studioTokens(scheme));
      expect(style.mascot).toBe('none');
    },
  );

  it("is Studio's own when the cached painting is another install's", () => {
    const style = resolveStyle(
      input(THEME, { themePaint: painting({ installId: 'another-install', mascot: true }) }),
    );
    expect(style.tokens).toBe(studioTokens('light'));
    expect(style.mascot).toBe('none');
  });

  it.each(SCHEME_GRID)(
    'follows %s on a %s phone with its own colours',
    (studioScheme, systemScheme) => {
      const paint = painting();
      const scheme = expectedScheme(studioScheme, systemScheme);
      const style = resolveStyle(input(THEME, { studioScheme, systemScheme, themePaint: paint }));
      expect(style.layout).toBe('studio');
      expect(style.tone).toBe(scheme);
      expect(style.tokens.style).toBe('studio');
      expect(style.tokens.scheme).toBe(scheme);
      expect(style.tokens.colours).toBe(paint.colours[scheme]);
      expect(style.radii).toBe(STYLE_RADII.studio);
      expect(style.type).toBe(styleType({ layout: 'studio' }));
    },
  );

  it('keeps the tone a theme fixes, whatever the scheme says', () => {
    const paint = painting({ tone: 'dark' });
    const style = resolveStyle(input(THEME, { studioScheme: 'light', themePaint: paint }));
    expect(style.tone).toBe('dark');
    expect(style.tokens.colours).toBe(paint.colours.dark);
  });

  it("shows the theme's Auto when it brings one", () => {
    expect(resolveStyle(input(THEME, { themePaint: painting({ mascot: true }) })).mascot).toBe(
      'theme',
    );
    expect(resolveStyle(input(THEME, { themePaint: painting() })).mascot).toBe('none');
  });

  it('never paints a theme over Play or HUD', () => {
    const paint = painting({ mascot: true });
    expect(resolveStyle(input(PLAY, { themePaint: paint })).tokens).toBe(playStyleTokens(EMBER));
    expect(resolveStyle(input(HUD, { themePaint: paint })).mascot).toBe('bundled');
  });
});

describe('motion (D-A11Y)', () => {
  const CHOICES = [STUDIO, PLAY, HUD, THEME];

  it.each(CHOICES)('Reduce Motion stops every loop: %o', (choice) => {
    expect(resolveStyle(input(choice, { reduceMotion: true })).motion).toEqual({
      loops: false,
      reason: 'reduce-motion',
    });
  });

  it.each(CHOICES)('loops run otherwise: %o', (choice) => {
    expect(resolveStyle(input(choice)).motion).toEqual({ loops: true, reason: null });
  });

  it("HUD's look with motion off stops HUD's loops, and only HUD's", () => {
    expect(resolveStyle(input(HUD, { hudLook: HUD_STILL })).motion).toEqual({
      loops: false,
      reason: 'look',
    });
    expect(resolveStyle(input(PLAY, { hudLook: HUD_STILL })).motion.loops).toBe(true);
    expect(resolveStyle(input(STUDIO, { hudLook: HUD_STILL })).motion.loops).toBe(true);
  });

  it('names Reduce Motion first when both stop the loops', () => {
    expect(motionOf('hud', HUD_STILL, true)).toEqual({ loops: false, reason: 'reduce-motion' });
    expect(motionOf('hud', HUD_STILL, false)).toEqual({ loops: false, reason: 'look' });
    expect(motionOf('hud', HUD_DEFAULT_LOOK, false)).toEqual({ loops: true, reason: null });
  });
});

describe("StyleScope's input", () => {
  const app = input(STUDIO, { studioScheme: 'dark' });

  it('swaps only the choice when no look is given', () => {
    expect(scopeInput(app, PLAY)).toEqual({ ...app, choice: PLAY });
  });

  it('swaps the Play look for a Play look and the HUD look for a HUD look', () => {
    expect(scopeInput(app, PLAY, DAYLIGHT)).toEqual({ ...app, choice: PLAY, playLook: DAYLIGHT });
    expect(scopeInput(app, HUD, GHOST)).toEqual({ ...app, choice: HUD, hudLook: GHOST });
  });

  it("paints a preview in its own style and leaves the app's input alone", () => {
    const before = JSON.stringify(app);
    const preview = resolveStyle(scopeInput(app, HUD, GHOST));
    expect(preview.layout).toBe('hud');
    expect(preview.hudLook).toBe(GHOST);
    expect(JSON.stringify(app)).toBe(before);
    expect(resolveStyle(app).layout).toBe('studio');
  });
});
