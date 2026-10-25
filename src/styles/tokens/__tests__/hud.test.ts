// HUD's tokens against looks.json and the vendored look kit: the data copied exactly, the
// catalogue the kit's AA rules run on, the README's derived variables, the glow never past the
// vendored safeGlow, AA for every ground x accent pair (the vendored contrastRatio), and the
// Studio-keyed set with exactly Studio's keys.

import { describe, expect, it } from 'vitest';

import { AA_TEXT, contrastRatio, mixHex } from '../../../core/web/lib/look-kit/contrast';
import {
  accentTextOf,
  duskOf,
  errorTextOf,
  rgba,
  safeGlow,
} from '../../../core/web/lib/look-kit/css';
import {
  HUD_ACCENTS,
  HUD_ACCENT_KEYS,
  HUD_DEFAULT_PRESET_ID,
  HUD_FIXED,
  HUD_FONTS,
  HUD_GLOW_RANGE,
  HUD_GRID_RANGE,
  HUD_GROUNDS,
  HUD_GROUND_KEYS,
  HUD_LOOK_CATALOGUE,
  HUD_PRESETS,
  type HudPreset,
} from '../hud-catalogue';
import {
  HUD_BRACKET,
  HUD_GLOW,
  HUD_GRID,
  HUD_SCANLINES,
  HUD_TONE,
  HUD_VAR_NAMES,
  hudGlow,
  hudTokens,
  hudVars,
  type HudPaintPicks,
} from '../hud';
import { STUDIO_COLOURS } from '../studio';

const HEX6 = /^#[0-9A-F]{6}$/;
const HEX8 = /^#[0-9A-F]{8}$/;
/** What React Native's normalize-colors reads: #RRGGBB, or rgba() with 0-255 channels. */
const RN_COLOUR = /^(?:#[0-9A-F]{6}|rgba\((?:\d{1,3},){3}(?:0|1|\d*\.\d+)\))$/i;

const ARC = HUD_PRESETS[0];

/** Every ground x accent pair the Looks drawer can make (4 x 6), at the strongest glow. */
const PAIRS: readonly HudPaintPicks[] = HUD_GROUND_KEYS.flatMap((ground) =>
  HUD_ACCENT_KEYS.map((accent) => ({
    ground,
    accent,
    grid: HUD_GRID_RANGE.max,
    glow: HUD_GLOW_RANGE.max,
  })),
);

const sorted = (record: object) => Object.keys(record).sort();
const label = (look: HudPaintPicks) => `${look.ground}/${look.accent}`;

function alphaOf(colour: string): number {
  const match = /,(\d*\.?\d+)\)$/.exec(colour);
  if (!match) throw new Error(`${colour} isn't an rgba() colour`);
  return Number(match[1]);
}

describe('hud-catalogue (looks.json, automatos-interface-look/v0, copied exactly)', () => {
  it('copies the six accents and four grounds', () => {
    expect(HUD_ACCENTS).toEqual({
      arc: { hex: '#3FE0FF', ink: '#021116' },
      forge: { hex: '#FF8A3D', ink: '#1A0A02' },
      ghost: { hex: '#E3ECF0', ink: '#06090B' },
      nova: { hex: '#FF5CDB', ink: '#1F0219' },
      signal: { hex: '#5CFF9A', ink: '#021208' },
      gold: { hex: '#FFC94A', ink: '#1C1400' },
    });
    expect(HUD_GROUNDS).toEqual({
      void: { bg: '#030507' },
      carbon: { bg: '#0B0B0D' },
      navy: { bg: '#050B18' },
      ember: { bg: '#0C0806' },
    });
  });

  it('copies the three fonts, the grid and glow ranges and the fixed values', () => {
    expect(HUD_FONTS).toEqual({
      raj: { family: 'Rajdhani', weight: 700, titlePx: 18, labelPx: 13 },
      chakra: { family: 'Chakra Petch', weight: 600, titlePx: 15, labelPx: 12 },
      mono: { family: 'Geist Mono', weight: 500, titlePx: 14, labelPx: 11 },
    });
    expect(HUD_GRID_RANGE).toEqual({ min: 0, max: 30 });
    expect(HUD_GLOW_RANGE).toEqual({ min: 0, max: 40 });
    expect(HUD_FIXED).toEqual({
      text: '#E6F1F5',
      text2: '#93A6AF',
      line: 'rgba(230,241,245,.10)',
      track: 'rgba(230,241,245,.08)',
      error: '#FF6B6B',
      bodyFont: 'Geist',
      monoFont: 'Geist Mono',
    });
  });

  it('copies the five presets in order, ARC the default', () => {
    const row = (p: HudPreset) => [p.id, p.name, p.ground, p.accent, p.font, p.grid, p.glow];
    const switches = (p: HudPreset) => [p.scan, p.auto, p.motion];
    expect(HUD_PRESETS.map(row)).toEqual([
      ['arc', 'ARC', 'void', 'arc', 'raj', 14, 22],
      ['forge', 'FORGE', 'ember', 'forge', 'chakra', 8, 26],
      ['ghost', 'GHOST', 'carbon', 'ghost', 'mono', 6, 8],
      ['nova', 'NOVA', 'navy', 'nova', 'chakra', 16, 30],
      ['signal', 'SIGNAL', 'void', 'signal', 'mono', 22, 18],
    ]);
    expect(HUD_PRESETS.map(switches)).toEqual([
      [true, true, true],
      [false, true, true],
      [false, false, true],
      [true, true, true],
      [true, false, true],
    ]);
    expect(HUD_DEFAULT_PRESET_ID).toBe('arc');
    expect(HUD_PRESETS.every((preset) => Object.isFrozen(preset))).toBe(true);
  });
});

describe('HUD_LOOK_CATALOGUE (a vendored LookCatalogue)', () => {
  it('names the prefix, the error colour and the glow range', () => {
    expect(HUD_LOOK_CATALOGUE.prefix).toBe('hud');
    expect(HUD_LOOK_CATALOGUE.errorColour).toBe('#FF6B6B');
    expect(HUD_LOOK_CATALOGUE.glow).toEqual({ min: 0, max: 40 });
  });

  it('builds each ground from its bg and the fixed text', () => {
    for (const key of HUD_GROUND_KEYS) {
      const { bg } = HUD_GROUNDS[key];
      expect(HUD_LOOK_CATALOGUE.grounds[key], key).toEqual({
        bg,
        surface: mixHex(bg, '#E6F1F5', 0.035),
        text: '#E6F1F5',
        text2: '#93A6AF',
        line: 'rgba(230,241,245,.10)',
        chip: 'rgba(230,241,245,.08)',
        panel: rgba('#E6F1F5', 0.035),
      });
    }
  });

  it('carries the six accents, the three fonts as type styles, one shell and one light', () => {
    expect(HUD_LOOK_CATALOGUE.accents).toEqual(HUD_ACCENTS);
    expect(HUD_LOOK_CATALOGUE.typeStyles.raj).toEqual({
      family: 'Rajdhani',
      style: 'normal',
      weight: 700,
      letterSpacing: '.2em',
      sizes: { hero: 24, brand: 18, status: 24, card: 13 },
    });
    expect(Object.keys(HUD_LOOK_CATALOGUE.typeStyles)).toEqual(['raj', 'chakra', 'mono']);
    expect(Object.keys(HUD_LOOK_CATALOGUE.shells)).toEqual(['none']);
    expect(HUD_LOOK_CATALOGUE.shells.none.filter).toBe('none');
    expect(Object.keys(HUD_LOOK_CATALOGUE.lights)).toEqual(['accent']);
  });

  it('runs the vendored rules unchanged: the raw accent and error read, dusk from the bg', () => {
    for (const ground of HUD_GROUND_KEYS) {
      expect(errorTextOf(HUD_LOOK_CATALOGUE, ground), ground).toBe('#FF6B6B');
      expect(duskOf(HUD_LOOK_CATALOGUE, ground), ground).toBe(
        mixHex('#93A6AF', HUD_GROUNDS[ground].bg, 0.55),
      );
      for (const accent of HUD_ACCENT_KEYS) {
        expect(accentTextOf(HUD_LOOK_CATALOGUE, ground, accent), `${ground}/${accent}`).toBe(
          HUD_ACCENTS[accent].hex,
        );
      }
    }
  });
});

describe('hudVars (the README’s derived variables)', () => {
  it('derives ARC’s variables', () => {
    const vars = hudVars(ARC);
    expect(vars.bg).toBe('#030507');
    expect(vars.accent).toBe('#3FE0FF');
    expect(vars.accentInk).toBe('#021116');
    expect(vars.accentLine).toBe('rgba(63,224,255,0.45)');
    expect(vars.accentFill).toBe('rgba(63,224,255,0.12)');
    expect(vars.panelFill).toBe('rgba(63,224,255,0.035)');
    expect(vars.panelBorder).toBe('rgba(63,224,255,0.18)');
    expect(vars.bracket).toBe('rgba(63,224,255,0.7)');
    expect(alphaOf(vars.grid)).toBe(14 / 300);
    expect(vars.glow).toBe('rgba(63,224,255,0.22)');
    expect(vars.scanline).toBe('rgba(0,0,0,.18)');
    expect(vars.drawer).toBe('rgba(5,8,10,.82)');
  });

  it('keeps text, text2, line, track and the error fixed in every look', () => {
    for (const look of PAIRS) {
      const { text, text2, line, track, error } = hudVars(look);
      expect({ text, text2, line, track, error }, label(look)).toEqual({
        text: '#E6F1F5',
        text2: '#93A6AF',
        line: 'rgba(230,241,245,.10)',
        track: 'rgba(230,241,245,.08)',
        error: '#FF6B6B',
      });
    }
  });

  it('sets every variable as a React Native colour and freezes the set', () => {
    for (const look of [...HUD_PRESETS, ...PAIRS]) {
      const vars = hudVars(look);
      expect(sorted(vars)).toEqual([...HUD_VAR_NAMES].sort());
      for (const [name, colour] of Object.entries(vars)) {
        expect(colour, `${label(look)} ${name}`).toMatch(RN_COLOUR);
      }
      expect(Object.isFrozen(vars)).toBe(true);
    }
  });

  it('keeps the grid alpha inside looks.json’s range', () => {
    expect(alphaOf(hudVars({ ...ARC, grid: 99 }).grid)).toBe(30 / 300);
    expect(alphaOf(hudVars({ ...ARC, grid: -5 }).grid)).toBe(0);
  });

  it('names the phone’s geometry: brackets, grid, glow and scanlines', () => {
    expect(HUD_BRACKET).toEqual({ length: 14, thickness: 1.5 });
    expect(HUD_GRID).toEqual({ square: 32, line: 1 });
    expect(HUD_GLOW).toEqual({ width: 320, height: 320, centreX: 0.5, centreY: 0.4, fadeEnd: 0.7 });
    expect(HUD_SCANLINES).toEqual({ line: 1, period: 3 });
  });
});

describe('the glow cap (KS9: the vendored safeGlow)', () => {
  it('paints min(preset glow, safeGlow) for every preset; NOVA below its 30', () => {
    for (const preset of HUD_PRESETS) {
      const cap = safeGlow(HUD_LOOK_CATALOGUE, preset.ground, preset.accent);
      expect(hudGlow(preset), preset.id).toBe(Math.min(preset.glow, cap));
      expect(alphaOf(hudVars(preset).glow), preset.id).toBe(Math.min(preset.glow, cap) / 100);
    }
    const caps = HUD_PRESETS.map((p) => [p.id, safeGlow(HUD_LOOK_CATALOGUE, p.ground, p.accent)]);
    expect(Object.fromEntries(caps)).toEqual({
      arc: 23,
      forge: 27,
      ghost: 18,
      nova: 29,
      signal: 21,
    });
    const painted = HUD_PRESETS.map((preset) => [preset.id, hudGlow(preset)]);
    expect(Object.fromEntries(painted)).toEqual({
      arc: 22,
      forge: 26,
      ghost: 8,
      nova: 29,
      signal: 18,
    });
  });

  it('never paints past the cap, even at the slider’s end', () => {
    for (const look of PAIRS) {
      const cap = safeGlow(HUD_LOOK_CATALOGUE, look.ground, look.accent);
      expect(hudGlow(look), label(look)).toBe(cap);
      expect(hudGlow(look), label(look)).toBeLessThanOrEqual(HUD_GLOW_RANGE.max);
    }
  });
});

describe('AA on every ground x accent pair (D-A11Y, the vendored contrastRatio)', () => {
  it('reads text, text2, the accent, its ink and the error at 4.5 or better', () => {
    for (const look of PAIRS) {
      const vars = hudVars(look);
      const { card } = hudTokens(look);
      const glowGround = mixHex(vars.bg, vars.accent, hudGlow(look) / 100);
      const pairs: readonly (readonly [string, string, string])[] = [
        ['text on bg', vars.text, vars.bg],
        ['text2 on bg', vars.text2, vars.bg],
        ['text on card', vars.text, card],
        ['text2 on card', vars.text2, card],
        ['accentInk on accent', vars.accentInk, vars.accent],
        ['accent on bg', vars.accent, vars.bg],
        ['error on bg', vars.error, vars.bg],
        ['text on the glow', vars.text, glowGround],
        ['text2 on the glow', vars.text2, glowGround],
      ];
      for (const [what, foreground, background] of pairs) {
        const ratio = contrastRatio(foreground, background);
        expect(ratio, `${label(look)} ${what}`).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });

  it('reads text2 on every fill a shared screen sets muted text on', () => {
    for (const look of PAIRS) {
      const tokens = hudTokens(look);
      for (const fill of ['secondary', 'muted', 'ccHover', 'input'] as const) {
        const ratio = contrastRatio(tokens.mutedForeground, tokens[fill]);
        expect(ratio, `${label(look)} ${fill}`).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });
});

describe('hudTokens (the Studio-keyed set, always dark)', () => {
  it('has exactly the Studio set’s keys and paints dark', () => {
    expect(HUD_TONE).toBe('dark');
    for (const look of [...HUD_PRESETS, ...PAIRS]) {
      expect(sorted(hudTokens(look))).toEqual(sorted(STUDIO_COLOURS.dark));
    }
  });

  it('maps ARC’s fills, text and the accent as the story lists', () => {
    const tokens = hudTokens(ARC);
    const bg = '#030507';
    const accent = '#3FE0FF';
    expect(tokens.background).toBe(bg);
    expect(tokens.foreground).toBe('#E6F1F5');
    expect(tokens.card).toBe(mixHex(bg, accent, 0.035));
    expect(tokens.popover).toBe(tokens.card);
    expect([tokens.cardForeground, tokens.popoverForeground, tokens.secondaryForeground]).toEqual([
      '#E6F1F5',
      '#E6F1F5',
      '#E6F1F5',
    ]);
    expect([tokens.primary, tokens.primaryForeground, tokens.ring]).toEqual([
      accent,
      '#021116',
      accent,
    ]);
    expect(tokens.secondary).toBe(mixHex(bg, accent, 0.12));
    expect(tokens.muted).toBe(mixHex(bg, '#E6F1F5', 0.08));
    expect(tokens.mutedForeground).toBe('#93A6AF');
    expect(tokens.border).toBe(mixHex(bg, accent, 0.18));
    expect(tokens.input).toBe(mixHex(bg, '#E6F1F5', 0.1));
    expect(tokens.ccHover).toBe(mixHex(bg, accent, 0.12));
    expect(tokens.ccHoverBorder).toBe(mixHex(bg, accent, 0.45));
  });

  it('paints --accent and --destructive the fixed error, with the bg as their ink', () => {
    for (const look of PAIRS) {
      const tokens = hudTokens(look);
      const { bg } = HUD_GROUNDS[look.ground];
      expect([tokens.accent, tokens.destructive], label(look)).toEqual(['#FF6B6B', '#FF6B6B']);
      const inks = [tokens.accentForeground, tokens.destructiveForeground];
      expect(inks, label(look)).toEqual([bg, bg]);
      expect(tokens.accent2, label(look)).toBe('#FF6B6B24');
    }
  });

  it('paints the semantic keys from the table: the accent, text2 for info, the chart steps', () => {
    const tokens = hudTokens(PAIRS[0]);
    const { bg } = HUD_GROUNDS[PAIRS[0].ground];
    const accent = HUD_ACCENTS[PAIRS[0].accent].hex;
    for (const name of ['success', 'olive', 'ccLiveDot', 'warning', 'warnInk', 'agent'] as const) {
      expect(tokens[name], name).toBe(accent);
    }
    expect(tokens.info).toBe('#93A6AF');
    expect([tokens.chart1, tokens.chart2, tokens.chart3, tokens.chart4, tokens.chart5]).toEqual([
      accent,
      mixHex(bg, accent, 0.8),
      mixHex(bg, accent, 0.6),
      mixHex(bg, accent, 0.4),
      '#93A6AF',
    ]);
  });

  it('writes every colour as #RRGGBB (accent2 #RRGGBBAA) and freezes the set', () => {
    for (const look of PAIRS) {
      const tokens = hudTokens(look);
      for (const [name, hex] of Object.entries(tokens)) {
        expect(hex, `${label(look)} ${name}`).toMatch(name === 'accent2' ? HEX8 : HEX6);
      }
      expect(Object.isFrozen(tokens)).toBe(true);
    }
  });
});
