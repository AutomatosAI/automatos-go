// Play's tokens against the vendored look engine: the tone per ground, the Studio-keyed set with
// exactly Studio's keys, Ember's own variables, AA for every ground x accent pair (the vendored
// contrastRatio), the glow never past the vendored safeGlowAlpha, and the page glow per state.

import { describe, expect, it } from 'vitest';

import { contrastRatio } from '../../../core/web/lib/look-kit/contrast';
import { studioConsequence } from '../../../core/web/lib/look-kit/studio-tokens';
import { ACCENT_KEYS, GROUND_KEYS } from '../../../core/frozen/lib/looks/catalogue';
import {
  PLAY_LOOK_CATALOGUE,
  lookToStudioTokens,
  safeGlowAlpha,
} from '../../../core/frozen/lib/looks/engine';
import {
  AURORA,
  DAYLIGHT,
  EMBER,
  OBSIDIAN,
  PRESETS,
  WORKSHOP,
} from '../../../core/frozen/lib/looks/presets';
import { GLOW_MAX, type Look } from '../../../core/frozen/lib/looks/types';
import { MASCOT_STATES } from '../../../core/frozen/lib/mascot/types';
import {
  PLAY_GLOW_CROSSFADE_MS,
  PLAY_PAGE_GLOW,
  PLAY_VAR_NAMES,
  pageGlowLayers,
  playTokens,
  playTone,
  playVars,
} from '../play';
import { STUDIO_COLOURS, sourceToHex } from '../studio';

const HEX6 = /^#[0-9A-F]{6}$/;
const HEX8 = /^#[0-9A-F]{8}$/;
/** What React Native's normalize-colors reads: #RRGGBB, or rgba() with 0-255 channels. */
const RN_COLOUR = /^(?:#[0-9A-F]{6}|rgba\((?:\d{1,3},){3}(?:0|1|0?\.\d+)\))$/i;
const AA = 4.5;

/** Every ground x accent pair the look page can make (4 x 6), at the strongest glow. */
const PAIRS: readonly Look[] = GROUND_KEYS.flatMap((ground) =>
  ACCENT_KEYS.map((accent) => ({ ...EMBER, ground, accent, glow: GLOW_MAX })),
);

const sorted = (record: object) => Object.keys(record).sort();

function alphaOf(rgba: string): number {
  const match = /,(\d*\.?\d+)\)$/.exec(rgba);
  if (!match) throw new Error(`${rgba} isn't an rgba() colour`);
  return Number(match[1]);
}

describe('playTone (PRD-260 K4: the ground sets the tone)', () => {
  it('paints Daylight light and the other presets dark', () => {
    expect(
      [EMBER, OBSIDIAN, AURORA, WORKSHOP, DAYLIGHT].map((look) => [look.id, playTone(look)]),
    ).toEqual([
      ['ember', 'dark'],
      ['obsidian', 'dark'],
      ['aurora', 'dark'],
      ['workshop', 'dark'],
      ['daylight', 'light'],
    ]);
  });

  it('follows the ground alone: Paper light; Graphite, Obsidian and Night dark', () => {
    const tones = GROUND_KEYS.map((ground) => [ground, playTone({ ...EMBER, ground })]);
    expect(Object.fromEntries(tones)).toEqual({
      graphite: 'dark',
      obsidian: 'dark',
      indigo: 'dark',
      paper: 'light',
    });
  });
});

describe('playTokens (PRD-260 D3: a look as Studio-keyed tokens)', () => {
  it('has exactly the Studio set’s keys in both tones', () => {
    expect(sorted(playTokens(EMBER))).toEqual(sorted(STUDIO_COLOURS.dark));
    expect(sorted(playTokens(DAYLIGHT))).toEqual(sorted(STUDIO_COLOURS.light));
    for (const look of PAIRS) expect(sorted(playTokens(look))).toEqual(sorted(STUDIO_COLOURS.dark));
  });

  it('lays the look over the tone’s Studio set, converted to hex', () => {
    const tokens = playTokens(EMBER);
    const look = lookToStudioTokens(EMBER);
    expect(tokens.background).toBe('#131110');
    expect(tokens.card).toBe('#1D1917');
    expect(tokens.foreground).toBe('#F4EEE8');
    expect(tokens.primary).toBe(sourceToHex(look['--primary']));
    expect(tokens.fg3).toBe(sourceToHex(look['--fg-3']));
    expect(tokens.border2).toBe(sourceToHex(look['--border-2']));
  });

  it('keeps the tone’s Studio value for every key the look does not set', () => {
    const dark = playTokens(EMBER);
    const light = playTokens(DAYLIGHT);
    for (const name of ['success', 'warning', 'info', 'chart1', 'olive', 'navy', 'running'] as const) {
      expect(dark[name], name).toBe(STUDIO_COLOURS.dark[name]);
      expect(light[name], name).toBe(STUDIO_COLOURS.light[name]);
    }
  });

  it('keeps --accent-2’s alpha as #RRGGBBAA: the error colour at Studio Dark’s 0.14, Light’s 0.10', () => {
    expect(playTokens(EMBER).accent2).toBe(`${studioConsequence(PLAY_LOOK_CATALOGUE, 'graphite').fill}24`);
    expect(playTokens(DAYLIGHT).accent2).toBe(`${studioConsequence(PLAY_LOOK_CATALOGUE, 'paper').fill}1A`);
  });

  it('writes every colour as #RRGGBB (accent2 #RRGGBBAA) and freezes the set', () => {
    for (const look of [...PAIRS, DAYLIGHT]) {
      const tokens = playTokens(look);
      for (const [name, hex] of Object.entries(tokens)) {
        expect(hex, `${look.ground}/${look.accent} ${name}`).toMatch(name === 'accent2' ? HEX8 : HEX6);
      }
      expect(Object.isFrozen(tokens)).toBe(true);
    }
  });
});

describe('playVars (the --pl-* set, re-keyed)', () => {
  it('gives Ember its ground, accent, ink and light', () => {
    const vars = playVars(EMBER);
    expect(vars.groundBg).toBe('#131110');
    expect(vars.accent).toBe('#FF6A1F');
    expect(vars.accentInk).toBe('#1A0A02');
    expect(vars.autoLight).toBe('#4BF0B7');
    expect(vars.groundLine).toBe('rgba(244,238,232,.12)');
    expect(vars.autoShellFilter).toBe('none');
  });

  it('has exactly the PlayVars keys, frozen', () => {
    for (const look of PRESETS) {
      const vars = playVars(look);
      expect(sorted(vars)).toEqual([...PLAY_VAR_NAMES].sort());
      expect(Object.isFrozen(vars)).toBe(true);
    }
  });

  it('keeps every colour a React Native colour string', () => {
    for (const look of PAIRS) {
      const { autoShellFilter, ...colours } = playVars(look);
      expect(typeof autoShellFilter).toBe('string');
      for (const [name, value] of Object.entries(colours)) {
        expect(value, `${look.ground}/${look.accent} ${name}`).toMatch(RN_COLOUR);
      }
    }
  });

  it('never paints the glow past the vendored safeGlowAlpha', () => {
    for (const look of [...PAIRS, ...PRESETS]) {
      const cap = safeGlowAlpha(look.ground, look.accent);
      expect(alphaOf(playVars(look).glow), `${look.ground}/${look.accent}`).toBeLessThanOrEqual(cap);
    }
    expect(alphaOf(playVars(EMBER).glow)).toBe(Math.min(EMBER.glow / 100, safeGlowAlpha('graphite', 'molten')));
  });
});

describe('AA for every ground x accent (vendored contrastRatio)', () => {
  it.each(PAIRS.map((look) => [`${look.ground}/${look.accent}`, look] as const))(
    '%s: text, primary, muted text and the accent text read at 4.5:1',
    (_, look) => {
      const tokens = playTokens(look);
      const vars = playVars(look);
      expect(contrastRatio(tokens.foreground, tokens.background)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(tokens.primaryForeground, tokens.primary)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(tokens.mutedForeground, tokens.card)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(vars.accentText, vars.groundBg)).toBeGreaterThanOrEqual(AA);
    },
  );
});

describe('the page glow (app/play-theme.css)', () => {
  it('sets each level’s glow and snag layers', () => {
    expect(PLAY_PAGE_GLOW).toEqual({
      calm: { accent: 0.45, snag: 0 },
      busy: { accent: 0.7, snag: 0 },
      bright: { accent: 1, snag: 0 },
      snag: { accent: 0, snag: 1 },
      off: { accent: 0, snag: 0 },
    });
    expect(PLAY_GLOW_CROSSFADE_MS).toBe(600);
    expect(Object.isFrozen(PLAY_PAGE_GLOW)).toBe(true);
  });

  it('keys the levels by the vendored pageGlow for every state', () => {
    const glows = Object.fromEntries(MASCOT_STATES.map((state) => [state, pageGlowLayers(state)]));
    expect(glows.hello).toBe(PLAY_PAGE_GLOW.bright);
    expect(glows.celebrate).toBe(PLAY_PAGE_GLOW.bright);
    expect(glows.idle).toBe(PLAY_PAGE_GLOW.calm);
    expect(glows.searching).toBe(PLAY_PAGE_GLOW.busy);
    expect(glows.oops).toBe(PLAY_PAGE_GLOW.snag);
    expect(glows.sleeping).toBe(PLAY_PAGE_GLOW.off);
    expect(Object.keys(glows)).toHaveLength(MASCOT_STATES.length);
  });
});
