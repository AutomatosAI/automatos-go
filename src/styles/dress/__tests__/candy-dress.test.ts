// Candy's dress (US-023k, D-ONE-SET, CANDY-LAYOUT §7): every panel a window (the win fill, rs
// corners, no line, the palette's tinted shadow at the look's glow), a selected one ringed in the
// accent; section titles in Outfit 600 20; glyph and word statuses; buttons, chips and segments
// round pills, 44 high at least, in Nunito 800 13 (an edge screen's action 50); primary the accent
// with its ink, secondary the chip with the text, a chosen chip or segment the accent with its ink;
// rows 52 over 1.5 pt rules; the slider the accent on the chip; the palette's page as the ground.
// Every word the paints put on a ground reads at AA (the vendored contrastRatio) in every preset.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { AA_TEXT, contrastRatio } from '../../../core/web/lib/look-kit/contrast';
import { edgeActionHeight } from '../../../ui/dressed';
import { BUTTON_PAINTS, type ButtonVariant } from '../../../ui/variants';
import { CANDY_PRESET_LOOKS } from '../../candy/look-schema';
import { EDGE_METRICS } from '../../edges/metrics';
import type { ResolvedStyle } from '../../provider/resolve';
import { CANDY_GLOW, candyGlowAlpha, innerRadius, type CandyVars } from '../../tokens/candy';
import { STUDIO_RADII } from '../../tokens/studio';
import { CANDY_MIN, CANDY_STEPS } from '../../typeface/candy-type';
import { CANDY_LINE, CSS_BLUR_PER_SHADOW_RADIUS, candyShadowLayers } from '../candy-paints';
import { CANDY_EDGE_ACTION_HEIGHT, CANDY_ROW_HEIGHT, DRESS_MIN_HEIGHT, dressOf } from '../dress';
import type { Paint } from '../paints';
import { ALL_STYLES, CANDY, CANDY_STYLES } from './fixtures';

const VARIANTS = Object.keys(BUTTON_PAINTS) as ButtonVariant[];
const ROUND = STUDIO_RADII.full;

function varsOf(style: ResolvedStyle): CandyVars {
  if (!style.candy) throw new Error('fixture without its variables');
  return style.candy;
}

function lookOf(style: ResolvedStyle) {
  if (!style.candyLook) throw new Error('fixture without its look');
  return style.candyLook;
}

describe('dressOf under Candy: the kinds', () => {
  it('gives every look cards, section heads, glyph statuses and the page', () => {
    for (const style of CANDY_STYLES) {
      expect(dressOf(style)).toMatchObject({
        layout: 'candy',
        panel: 'card',
        panelHeader: 'section',
        status: 'glyph',
        ground: 'candy-page',
      });
    }
  });

  it('covers the three presets', () => {
    const palettes = CANDY_STYLES.map((style) => lookOf(style).palette);
    for (const look of CANDY_PRESET_LOOKS) expect(palettes).toContain(look.palette);
  });

  it('refuses a Candy style without its variables or its look, and freezes the dress', () => {
    const { candy: _vars, ...noVars } = CANDY;
    expect(() => dressOf(noVars as ResolvedStyle)).toThrow(/candy/);
    const { candyLook: _look, ...noLook } = CANDY;
    expect(() => dressOf(noLook as ResolvedStyle)).toThrow(/candy/);
    expect(Object.isFrozen(dressOf(CANDY))).toBe(true);
  });
});

describe('dressOf under Candy: corners', () => {
  it('rounds every control fully and gives panels, fields and sheets rs (CANDY-LAYOUT §3)', () => {
    for (const style of CANDY_STYLES) {
      const dress = dressOf(style);
      const rs = innerRadius(lookOf(style).roundness);
      const { radii } = dress;
      expect([radii.control, radii.chip, radii.pill, radii.segment, radii.tag]).toEqual(
        Array(5).fill(ROUND),
      );
      expect([dress.button.radius, dress.pill.radius]).toEqual([ROUND, ROUND]);
      expect([radii.card, radii.panel, radii.input, dress.sheetRadius]).toEqual(Array(4).fill(rs));
      expect(dress.grabberRadius).toBeGreaterThan(0);
    }
  });

  it('follows the Roundness knob: 12 at 16, 20 at 28, 23 at Lilac’s 32, 29 at 40', () => {
    const cards = CANDY_STYLES.map((style) => dressOf(style).radii.card);
    expect(new Set(cards)).toEqual(new Set([12, 20, 23, 29]));
  });
});

describe('dressOf under Candy: type and sizes', () => {
  it('sets buttons at least 44 in and out of a panel, in Nunito 800 at the button step', () => {
    expect(dressOf(CANDY).button).toEqual({
      radius: ROUND,
      minHeight: DRESS_MIN_HEIGHT,
      panelMinHeight: DRESS_MIN_HEIGHT,
      labelFace: { role: 'sans', weight: 800 },
      labelSize: CANDY_STEPS.button,
      labelCase: 'as-written',
      trackingEm: 0,
    });
  });

  it('labels in Nunito 700 at the label step, chips 44 high in 800, 18 in', () => {
    const dress = dressOf(CANDY);
    expect(dress.label).toEqual({
      face: { role: 'sans', weight: 700 },
      size: CANDY_STEPS.label,
      case: 'as-written',
      trackingEm: 0,
    });
    expect(dress.pill).toEqual({
      radius: ROUND,
      minHeight: DRESS_MIN_HEIGHT,
      paddingX: 'space8',
      restWeight: 800,
      selectedWeight: 800,
    });
    expect(CANDY.tokens.spacing.space8).toBe(18);
  });

  it('never sizes a label or a button under Candy’s 12 (D-A11Y)', () => {
    for (const style of CANDY_STYLES) {
      const dress = dressOf(style);
      expect(dress.label.size).toBeGreaterThanOrEqual(CANDY_MIN);
      expect(dress.button.labelSize ?? 0).toBeGreaterThanOrEqual(CANDY_MIN);
    }
  });

  it('sets rows 52 over 1.5 pt rules, and raises an edge screen’s action to 50', () => {
    for (const style of CANDY_STYLES) {
      const dress = dressOf(style);
      expect(dress.row).toEqual({ minHeight: CANDY_ROW_HEIGHT, separatorWidth: CANDY_LINE });
      expect(dress.edgeActionMinHeight).toBe(CANDY_EDGE_ACTION_HEIGHT);
      expect(edgeActionHeight(dress, EDGE_METRICS.action.height)).toBe(50);
    }
    expect([CANDY_ROW_HEIGHT, CANDY_LINE, CANDY_EDGE_ACTION_HEIGHT]).toEqual([52, 1.5, 50]);
  });

  it('leaves every other style’s rows, rules and edge action as they were', () => {
    for (const style of ALL_STYLES.filter((each) => each.layout !== 'candy')) {
      const dress = dressOf(style);
      expect(dress.row).toEqual({ minHeight: 44, separatorWidth: 1 });
      expect(dress.edgeActionMinHeight).toBeNull();
      expect(edgeActionHeight(dress, EDGE_METRICS.action.height)).toBe(48);
    }
  });

  it('draws the edge screens’ action at the dress’s height (parts.tsx EdgeAction)', () => {
    const source = readFileSync(path.resolve(__dirname, '../../edges/parts.tsx'), 'utf8');
    expect(source).toContain('const minHeight = edgeActionHeight(useDress(), action.height);');
    expect(source).toContain('fullWidth minHeight={minHeight} />');
  });
});

describe('dressOf under Candy: paints', () => {
  it('paints primary the accent with its ink, secondary the chip, outline the hairline, ghost the quiet text', () => {
    for (const style of CANDY_STYLES) {
      const v = varsOf(style);
      const { button } = dressOf(style).paints;
      expect(button.primary.rest).toEqual({
        background: v.accent,
        border: v.accent,
        foreground: v.accentInk,
      });
      expect(button.primary.pressedOpacity).toBe(0.9);
      expect(button.secondary.rest).toEqual({
        background: v.chip,
        border: v.chip,
        foreground: v.text,
      });
      expect(button.outline.rest).toEqual({
        background: 'transparent',
        border: v.border,
        foreground: v.text,
      });
      expect(button.ghost.rest).toEqual({
        background: 'transparent',
        border: 'transparent',
        foreground: v.quiet,
      });
      expect(button.ghost.pressed.background).toBe(v.chip);
    }
  });

  it('chips the window in the 1.5 pt hairline, the chosen chip and segment the accent with its ink', () => {
    for (const style of CANDY_STYLES) {
      const v = varsOf(style);
      const { pill, segment } = dressOf(style).paints;
      expect(pill.rest).toEqual({ background: v.win, border: v.border, foreground: v.text });
      expect(pill.pressed.background).toBe(v.chip);
      expect(pill.selected).toEqual({
        background: v.accent,
        border: v.accent,
        foreground: v.accentInk,
      });
      expect([pill.borderWidth, pill.selectedBorderWidth]).toEqual([1.5, 1.5]);
      expect(segment).toEqual({
        track: v.chip,
        rest: { background: 'transparent', foreground: v.quiet },
        selected: { background: v.accent, foreground: v.accentInk },
        selectedShadow: false,
      });
    }
  });

  it('dresses every panel a window with no line, a selected one ringed in the accent', () => {
    for (const style of CANDY_STYLES) {
      const v = varsOf(style);
      const { panel } = dressOf(style).paints;
      expect(panel.rest).toEqual({ background: v.win, border: v.win });
      expect(panel.pressed).toEqual({ background: v.chip, border: v.chip });
      expect(panel.selected).toEqual({ background: v.win, border: v.accent });
      expect([panel.borderWidth, panel.selectedBorderWidth]).toEqual([1.5, 1.5]);
      expect(panel.bracket).toBeNull();
    }
  });

  it('shadows every panel in the palette’s tint at the look’s glow: 0, 14 and the kit’s 40 blur', () => {
    for (const style of CANDY_STYLES) {
      const look = lookOf(style);
      const { panel } = dressOf(style).paints;
      const layers = candyShadowLayers(look);
      expect(panel.frame).toEqual(layers);
      expect(panel.selectedGlow).toEqual(layers);
      expect(layers).toHaveLength(1);
      const [layer] = layers;
      expect(layer).toMatchObject({ offsetX: 0, offsetY: 14, blurRadius: 40, spreadDistance: 0 });
      expect(layer.inset).toBeUndefined();
      const alpha = Number(/,([\d.]+)\)$/.exec(layer.color)?.[1]);
      expect(alpha).toBeCloseTo(candyGlowAlpha(look.glow), 10);
    }
    expect(CSS_BLUR_PER_SHADOW_RADIUS).toBe(2);
  });

  it('tints the shadow from .04 at no glow to .04 + 10 / 33 at the most', () => {
    const alphaAt = (glow: number) => {
      const style = CANDY_STYLES.find((each) => lookOf(each).glow === glow);
      if (!style) throw new Error(`no fixture at glow ${glow}`);
      return Number(/,([\d.]+)\)$/.exec(candyShadowLayers(lookOf(style))[0].color)?.[1]);
    };
    expect(alphaAt(CANDY_GLOW.min)).toBeCloseTo(0.04, 10);
    expect(alphaAt(CANDY_GLOW.max)).toBeCloseTo(0.04 + 10 / 33, 10);
  });

  it('draws the slider’s fill and thumb in the accent on the chip, the page past its cap', () => {
    for (const style of CANDY_STYLES) {
      const v = varsOf(style);
      expect(dressOf(style).paints.slider).toEqual({ fill: v.accent, track: v.chip, past: v.page });
    }
    for (const style of ALL_STYLES.filter((each) => each.layout !== 'candy')) {
      expect(dressOf(style).paints.slider).toBeNull();
    }
  });
});

describe('every word Candy’s dress paints reads at AA, in every preset', () => {
  it('on its own ground, at rest and pressed, and over the page and the window where it is clear', () => {
    const low: string[] = [];
    for (const style of CANDY_STYLES) {
      const v = varsOf(style);
      const { button, pill, segment, panel } = dressOf(style).paints;
      const grounds = (paint: Paint) =>
        paint.background === 'transparent' ? [v.page, v.win] : [paint.background];
      const pairs: (readonly [string, Paint])[] = [
        ...VARIANTS.flatMap((variant) => [
          [`${variant}`, button[variant].rest] as const,
          [`${variant} pressed`, button[variant].pressed] as const,
        ]),
        ['chip', pill.rest],
        ['chip pressed', pill.pressed],
        ['chip chosen', pill.selected],
      ];
      for (const [name, paint] of pairs) {
        for (const ground of grounds(paint)) {
          const ratio = contrastRatio(paint.foreground, ground);
          if (ratio < AA_TEXT) low.push(`${lookOf(style).palette} ${name} ${ratio.toFixed(2)}`);
        }
      }
      const segments = [
        ['segment', segment.rest.foreground, segment.track],
        ['segment chosen', segment.selected.foreground, segment.selected.background],
        ['text on a window', style.tokens.colours.foreground, panel.rest.background],
        ['muted on a window', style.tokens.colours.mutedForeground, panel.rest.background],
        ['text on a pressed window', style.tokens.colours.foreground, panel.pressed.background],
      ] as const;
      for (const [name, fg, bg] of segments) {
        const ratio = contrastRatio(fg, bg);
        if (ratio < AA_TEXT) low.push(`${lookOf(style).palette} ${name} ${ratio.toFixed(2)}`);
      }
    }
    expect(low).toEqual([]);
  });

  it('rings a selected window and draws the slider in an accent that holds 3:1 on the page and the window', () => {
    for (const style of CANDY_STYLES) {
      const v = varsOf(style);
      for (const ground of [v.page, v.win]) {
        expect(contrastRatio(v.accent, ground)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
