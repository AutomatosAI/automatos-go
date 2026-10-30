// The ground a Screen stands on per style, and the Screen primitive's order, read from its source
// (vitest runs no React Native renderer): the ground under the content, the scanlines over it, the
// status bar in the style's tone; the keyboard in Play's, HUD's and Arcade's tone, the window's
// under Studio. Arcade stands on its palette's page and draws nothing over the content (its
// scanlines live inside its windows, never over the AI label).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { EMBER, PRESETS } from '../../../core/frozen/lib/looks/presets';
import { ARCADE_PRESET_LOOKS } from '../../arcade/look-schema';
import { dressOf } from '../../dress/dress';
import {
  ARCADE,
  ARCADE_STYLES,
  HUD,
  HUD_STYLES,
  PLAY,
  PLAY_STYLES,
  STUDIO_STYLES,
} from '../../dress/__tests__/fixtures';
import { HUD_DEFAULT_LOOK } from '../../hud/look-schema';
import { resolveStyle, type ResolvedStyle } from '../../provider/resolve';
import { builtinChoice, type StyleChoice } from '../../registry/style-id';
import type { SystemScheme, ThemeChoice } from '../../theme-choice';
import { groundPlan, keyboardAppearanceFor, statusBarStyle } from '../ground';

function planFor(style: ResolvedStyle, kind: Parameters<typeof groundPlan>[0]['kind'] = 'page') {
  return groundPlan({ style, ground: dressOf(style).ground, kind, state: 'idle' });
}

describe('groundPlan', () => {
  it('leaves Studio and an installed theme on their plain background', () => {
    for (const style of STUDIO_STYLES) expect(planFor(style)).toEqual({ kind: 'plain' });
  });

  it("gives every Play look its page glow, and none where Ember's phone draws none", () => {
    for (const style of PLAY_STYLES) {
      const plan = planFor(style);
      expect(plan.kind).toBe('play-glow');
      if (plan.kind === 'play-glow') expect(plan.plan?.spot.alpha).toBe(0.16);
    }
    expect(planFor(PLAY, 'conversations')).toEqual({ kind: 'play-glow', plan: null });
  });

  it('gives every HUD look its glow, grid and scanlines on every screen', () => {
    for (const style of HUD_STYLES) expect(planFor(style).kind).toBe('hud-grid');
    expect(planFor(HUD, 'chat')).toEqual(planFor(HUD, 'lost'));
  });

  it("stands every Arcade look on its palette's page, on every screen", () => {
    for (const style of ARCADE_STYLES) {
      const page = style.arcade?.page;
      expect(page).toBe(style.tokens.colours.background);
      expect(planFor(style)).toEqual({ kind: 'arcade-page', page });
    }
    expect(planFor(ARCADE, 'chat')).toEqual(planFor(ARCADE, 'lost'));
  });

  it('stops the glow crossfade under Reduce Motion', () => {
    const still = { ...PLAY, motion: { loops: false, reason: 'reduce-motion' } } as const;
    const plan = planFor(still, 'chat');
    expect(plan.kind === 'play-glow' && plan.plan?.fadeMs).toBe(0);
  });

  it('falls back to plain if a dress and a style ever disagree', () => {
    const studio = STUDIO_STYLES[0];
    expect(groundPlan({ style: studio, ground: 'play-glow', kind: 'page', state: 'idle' })).toEqual({
      kind: 'plain',
    });
    const plan = groundPlan({ style: studio, ground: 'arcade-page', kind: 'page', state: 'idle' });
    expect(plan).toEqual({ kind: 'plain' });
  });
});

describe('statusBarStyle', () => {
  it('writes light on a dark tone and dark on a light one', () => {
    expect(statusBarStyle('dark')).toBe('light');
    expect(statusBarStyle('light')).toBe('dark');
  });

  it('follows each style: HUD always light, Play by its ground, Arcade by its palette', () => {
    for (const style of HUD_STYLES) expect(statusBarStyle(style.tone)).toBe('light');
    const daylight = PLAY_STYLES.find((style) => style.playLook?.id === 'daylight');
    expect(daylight && statusBarStyle(daylight.tone)).toBe('dark');
    for (const style of ARCADE_STYLES) {
      const light = style.arcadeLook?.palette === 'handheld';
      expect(statusBarStyle(style.tone)).toBe(light ? 'dark' : 'light');
    }
  });
});

describe('keyboardAppearanceFor', () => {
  const resolve = (
    choice: StyleChoice,
    studioScheme: ThemeChoice,
    systemScheme: SystemScheme,
    playLook = EMBER,
    arcadeLook = ARCADE_PRESET_LOOKS[0],
  ) =>
    resolveStyle({
      choice,
      studioScheme,
      systemScheme,
      playLook,
      hudLook: HUD_DEFAULT_LOOK,
      arcadeLook,
      themePaint: null,
      reduceMotion: false,
    });
  const SCHEMES: readonly (readonly [ThemeChoice, SystemScheme])[] = [
    ['light', 'dark'],
    ['dark', 'light'],
    ['system', 'light'],
    ['system', 'dark'],
    ['system', null],
  ];

  it("leaves Studio and an installed theme on 'default': the window's Light / Dark / System", () => {
    for (const [studio, system] of SCHEMES) {
      expect(keyboardAppearanceFor(resolve(builtinChoice('studio'), studio, system))).toBe(
        'default',
      );
    }
    for (const style of STUDIO_STYLES) expect(keyboardAppearanceFor(style)).toBe('default');
  });

  it('gives every Play preset its tone: Daylight light, the rest dark, whatever Studio says', () => {
    for (const look of PRESETS) {
      const expected = look.id === 'daylight' ? 'light' : 'dark';
      for (const [studio, system] of SCHEMES) {
        const style = resolve(builtinChoice('play'), studio, system, look);
        expect(keyboardAppearanceFor(style)).toBe(expected);
      }
    }
    for (const style of PLAY_STYLES) expect(keyboardAppearanceFor(style)).toBe(style.tone);
  });

  it('keeps HUD dark at every look and every Studio scheme', () => {
    for (const style of HUD_STYLES) expect(keyboardAppearanceFor(style)).toBe('dark');
    for (const [studio, system] of SCHEMES) {
      expect(keyboardAppearanceFor(resolve(builtinChoice('hud'), studio, system))).toBe('dark');
    }
  });

  it("gives every Arcade preset its palette's tone: Handheld light, the rest dark, whatever Studio says", () => {
    for (const look of ARCADE_PRESET_LOOKS) {
      const expected = look.palette === 'handheld' ? 'light' : 'dark';
      for (const [studio, system] of SCHEMES) {
        const style = resolve(builtinChoice('arcade'), studio, system, EMBER, look);
        expect(keyboardAppearanceFor(style)).toBe(expected);
      }
    }
    for (const style of ARCADE_STYLES) expect(keyboardAppearanceFor(style)).toBe(style.tone);
  });
});

describe("the app's text inputs", () => {
  const read = (file: string) => readFileSync(path.resolve(__dirname, '../../..', file), 'utf8');

  it('set the keyboard from the painted style: TextField, PillInput and PlayComposer', () => {
    expect(read('ui/TextField.tsx')).toContain(
      'keyboardAppearance={input.keyboardAppearance ?? keyboardAppearanceFor(style)}',
    );
    for (const file of ['chat/composer/PillInput.tsx', 'styles/play/companion/PlayComposer.tsx']) {
      expect(read(file)).toContain('keyboardAppearance={keyboardAppearanceFor(style)}');
    }
  });

  it("leave the window's appearance on Studio's choice (theme.tsx)", () => {
    expect(read('styles/theme.tsx')).toContain(
      'Appearance.setColorScheme(appearanceOverride(choice));',
    );
  });
});

describe('ScreenGround and ScreenOverlay', () => {
  const source = readFileSync(path.resolve(__dirname, '../ScreenGround.tsx'), 'utf8');
  const overlay = source.slice(source.indexOf('export function ScreenOverlay'));

  it("draw Arcade's page under the content and nothing of Arcade's over it", () => {
    expect(source).toContain("if (plan.kind === 'arcade-page') return <ArcadePage page={plan.page} />;");
    expect(overlay).not.toContain('arcade');
    expect(overlay).toContain("if (plan.kind === 'hud-grid')");
  });
});

describe('the Screen primitive', () => {
  const source = readFileSync(path.resolve(__dirname, '../../../ui/Screen.tsx'), 'utf8');

  it('sets the status bar to the tone, then the ground, the content and the scanlines', () => {
    const order = [
      '<StatusBar style={statusBarStyle(tone)} />',
      '<ScreenGround plan={plan} />',
      '<SafeAreaView',
      '<ScreenOverlay plan={plan} />',
    ].map((part) => source.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("keeps every prop it had and adds the screen's kind and Auto's state", () => {
    for (const prop of ['children', 'edges?', 'scroll?', 'padding?', 'style?', 'ground?', 'autoState?']) {
      expect(source).toContain(`readonly ${prop}:`);
    }
  });
});
